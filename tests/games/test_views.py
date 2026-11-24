import pytest
from django.contrib.flatpages.models import FlatPage
from django.contrib.sites.models import Site
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


def test_game_detail_renders_command_into_js_config(game, client, settings):
    settings.V86_BASE_URL = '/vm/'
    game.command = 'robots'
    game.refresh_code = 12
    game.save()

    response = client.get(game.get_absolute_url())

    assert response.context['game_config'] == {
        'id': game.id, 'command': 'robots', 'refreshCode': 12,
        'v86Base': '/vm/',
    }
    assert ('<script id="game-config" type="application/json">'
            f'{{"id": {game.id}, "command": "robots", "refreshCode": 12, '
            '"v86Base": "/vm/"}</script>') in response.content.decode()


def test_game_detail_escapes_command_in_js_config(game, client):
    game.command = '</script><script>alert(1)'
    game.save()

    content = client.get(game.get_absolute_url()).content.decode()

    assert '</script><script>alert(1)' not in content
    assert '\\u003C/script\\u003E' in content


@pytest.mark.parametrize('name, url', [('main', '/main/'), ('about', '/about/')])
def test_flatpages_render(name, url, client, db):
    page = FlatPage.objects.create(url=url, title=name, content=f'{name} text')
    page.sites.add(Site.objects.get_current())

    response = client.get(reverse(name))

    assert response.status_code == 200
    assert f'{name} text' in response.content.decode()


def test_admin_lists_games(game, admin_client):
    response = admin_client.get(reverse('admin:games_game_changelist'))

    assert response.status_code == 200
    assert 'Robots' in response.content.decode()
