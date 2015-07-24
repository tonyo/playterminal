import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from games.models import Game
from games.utils.stepicclient import StepicClient

STEPIC_LOGIN = 'stepic@playtermin.al'
STEPIC_PASSWORD = 'LzTspUE7PIucxuX5'


@require_POST
def games(request):
    data = json.loads(request.body.decode())
    game_id = data.get('id')
    game = get_object_or_404(Game, id=game_id)
    stepic_client = StepicClient(login=STEPIC_LOGIN, password=STEPIC_PASSWORD)
    attempt = stepic_client.create_attempt(game.step_id)

    # Save attempt id for future use
    attempt['dataset']['stepic_attempt_id'] = attempt['id']
    game_sessions_map = request.session.get('game_sessions', {})
    if not str(game_id) in game_sessions_map:
        game_sessions_map[str(game_id)] = attempt['dataset']
    game_session = game_sessions_map[str(game_id)]
    request.session['game_sessions'] = game_sessions_map
    return JsonResponse(game_session)
