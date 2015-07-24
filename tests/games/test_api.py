import json

from django.contrib.sessions.backends.db import SessionStore
from django.core.urlresolvers import reverse


def _post_json(client, url, data, **kwargs):
    return client.post(url, content_type='application/json',
                       data=json.dumps(data), **kwargs)


def test_new_game_session(game, client):
    response = _post_json(client, reverse('games'), {'id': game.id})

    game_session = json.loads(response.content.decode())
    assert game_session['kaylee_url']
    assert game_session['terminal_id']

    # Request once again, expect that the previous session is returned
    response = _post_json(client, reverse('games'), {'id': game.id})

    new_game_session = json.loads(response.content.decode())
    assert new_game_session == game_session


def test_outdated_game_session(game, client):
    _post_json(client, reverse('games'), {'id': game.id})

    # Update the game session
    invalid_attempt_id = 4729799
    session_object = SessionStore(session_key=client.session.session_key)
    invalid_game_session = session_object['game_sessions'][str(game.id)]
    invalid_game_session['stepic_attempt_id'] = invalid_attempt_id
    session_object.save()

    # Repeat request
    response = _post_json(client, reverse('games'), {'id': game.id})
    new_game_session = json.loads(response.content.decode())

    # Check that the new session is returned
    assert new_game_session != invalid_game_session