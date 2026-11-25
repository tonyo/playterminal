import re

import pytest
from django.contrib.flatpages.models import FlatPage
from django.contrib.sites.models import Site
from django.urls import reverse

from games import catalog


def test_game_list_shows_only_displayed_games(games, client):
    response = client.get(reverse("game_list"))

    assert response.status_code == 200
    content = response.content.decode()
    assert 'href="/game/robots/"' in content
    assert "Tetris" not in content


def test_games_file_lists_the_games_on_v86(client):
    response = client.get(reverse("game_list"))

    assert [game.name for game in response.context["games"]] == ["Robots", "NetHack"]


def test_games_file_has_unique_url_safe_slugs_and_commands():
    games = catalog.all_games()
    slugs = [game.slug for game in games]

    assert len(set(slugs)) == len(slugs)
    assert all(re.fullmatch(r"[a-z0-9-]+", slug) for slug in slugs)
    assert all(game.command for game in games)


def test_game_detail_has_play_button(game, client):
    response = client.get("/game/robots/")

    assert response.status_code == 200
    content = response.content.decode()
    assert "<h1>Robots</h1>" in content
    assert 'id="open-terminal-btn"' in content


def test_hidden_game_still_has_a_page(games, client):
    assert client.get("/game/tetris/").status_code == 200


def test_unknown_game_is_404(games, client):
    assert client.get("/game/pong/").status_code == 404


def test_game_detail_renders_command_into_js_config(client, settings, monkeypatch):
    settings.V86_BASE_URL = "/vm/"
    game = catalog.Game(slug="robots", name="Robots", info="", command="robots", refresh_code=12)
    monkeypatch.setattr(catalog, "all_games", lambda: (game,))

    response = client.get(game.get_absolute_url())

    assert response.context["game_config"] == {
        "command": "robots",
        "refreshCode": 12,
        "v86Base": "/vm/",
    }
    assert (
        '<script id="game-config" type="application/json">'
        '{"command": "robots", "refreshCode": 12, "v86Base": "/vm/"}</script>'
    ) in response.content.decode()


def test_game_detail_escapes_command_in_js_config(client, monkeypatch):
    game = catalog.Game(slug="x", name="X", info="", command="</script><script>alert(1)")
    monkeypatch.setattr(catalog, "all_games", lambda: (game,))

    content = client.get(game.get_absolute_url()).content.decode()

    assert "</script><script>alert(1)" not in content
    assert "\\u003C/script\\u003E" in content


def test_licenses_links_the_vm_third_party_list(client, db, settings):
    settings.V86_BASE_URL = "/vm/"

    response = client.get(reverse("licenses"))

    assert response.status_code == 200
    content = response.content.decode()
    assert 'href="/vm/THIRD-PARTY.txt"' in content
    assert "xterm-6.0.0/LICENSE" in content
    assert f'href="{reverse("licenses")}"' in content


@pytest.mark.parametrize("name, url", [("main", "/main/"), ("about", "/about/")])
def test_flatpages_render(name, url, client, db):
    page = FlatPage.objects.create(url=url, title=name, content=f"{name} text")
    page.sites.add(Site.objects.get_current())

    response = client.get(reverse(name))

    assert response.status_code == 200
    assert f"{name} text" in response.content.decode()
