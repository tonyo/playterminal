import json

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST
from requests import RequestException

from rootnroll import RootnRollClient
from rootnroll.constants import ServerStatus

from games.models import Game

"""
Session structure:

game_id -> {'server_id': '123...',
            'terminal_id': '234...',}

"""


def _terminal_response_ok(terminal):
    return JsonResponse({
        'status': 'ok',
        'terminal_id': terminal['id'],
        'kaylee_url': terminal['config']['kaylee_url'],
    })


def _terminal_response_creating():
    return JsonResponse({
        'status': 'creating',
    })


def _terminal_response_error(info=None):
    return JsonResponse({
        'status': 'error',
        'info': info,
    })


def get_rnr_client():
    return RootnRollClient(username=settings.ROOTNROLL_USERNAME,
                           password=settings.ROOTNROLL_PASSWORD,
                           api_url=settings.RNR_API_URL)


@require_POST
def terminals(request):
    data = json.loads(request.body.decode())
    game_id = data.get('id')
    game = get_object_or_404(Game, id=game_id)
    rnr_client = get_rnr_client()
    terminals_map = request.session.get('terminals_map', {})
    game_dict = terminals_map.get(str(game_id), {})
    server_id = game_dict.get('server_id')
    terminal_id = game_dict.get('terminal_id')

    if terminal_id:
        # Active terminal exists
        terminal = rnr_client.get_terminal(terminal_id)
        if terminal:
            return _terminal_response_ok(terminal)

    if server_id:
        # Server exists?
        server = rnr_client.get_server(server_id)
        if server and server['status'] == ServerStatus.ACTIVE:
            # Server is ready, create a terminal
            terminal = rnr_client.create_terminal(server)
            if terminal:
                game_dict['terminal_id'] = terminal['id']
                terminals_map[str(game_id)] = game_dict
                request.session['terminals_map'] = terminals_map
                return _terminal_response_ok(terminal)
        elif server and server['status'] != ServerStatus.ERROR:
            # Waiting for server to come up
            return _terminal_response_creating()

    # Server does not exist or invalid
    try:
        server = rnr_client.create_server(game.rnr_image_id)
    except RequestException as e:
        return _terminal_response_error()

    if server and 'id' in server:
        game_dict['server_id'] = server['id']
        terminals_map[str(game_id)] = game_dict
        request.session['terminals_map'] = terminals_map
        return _terminal_response_creating()
    else:
        # Cannot create the server
        return _terminal_response_error()
