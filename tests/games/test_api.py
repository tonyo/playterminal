import json
from django.core.urlresolvers import reverse


def test_new_game_session(game, client):
    response = client.post(reverse('games'), content_type='application/json',
                           data=json.dumps({'id': game.id}))

    game_session = json.loads(response.content.decode())
    assert game_session['kaylee_url']
    assert game_session['terminal_id']

    # request a new game and expect the previously created game is returned
    response = client.post(reverse('games'), content_type='application/json',
                           data=json.dumps({'id': game.id}))

    new_game_session = json.loads(response.content.decode())
    assert new_game_session == game_session
