from django.urls import reverse

from games.models import Game


def test_game_list_shows_only_displayed_games(game, client):
    Game.objects.create(name='Tetris', info='hidden', displayed=False)

    response = client.get(reverse('game_list'))

    assert response.status_code == 200
    content = response.content.decode()
    assert 'Robots' in content
    assert 'Tetris' not in content


def test_game_detail_has_play_button(game, client):
    response = client.get(game.get_absolute_url())

    assert response.status_code == 200
    assert 'id="open-terminal-btn"' in response.content.decode()
