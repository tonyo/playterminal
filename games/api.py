import json

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from games.models import Game
from games.utils.stepic_client import StepicClient


@require_POST
def games(request):
    data = json.loads(request.body.decode())
    game_id = data.get('id')
    game = get_object_or_404(Game, id=game_id)
    stepic_client = StepicClient(settings.STEPIC_CLIENT_ID,
                                 settings.STEPIC_CLIENT_SECRET)
    game_sessions_map = request.session.get('game_sessions', {})

    request_new_attempt = True
    if str(game_id) in game_sessions_map:
        # Check that the attempt is still active
        attempt_id = game_sessions_map[str(game_id)]['stepic_attempt_id']
        remote_attempt = stepic_client.get_attempt(attempt_id)
        if remote_attempt['status'] == 'active':
            request_new_attempt = False

    if request_new_attempt:
        attempt = stepic_client.create_attempt(game.step_id)
        # Save attempt id for future use
        attempt['dataset']['stepic_attempt_id'] = attempt['id']
        game_sessions_map[str(game_id)] = attempt['dataset']

    game_session = game_sessions_map[str(game_id)]
    request.session['game_sessions'] = game_sessions_map
    return JsonResponse(game_session)
