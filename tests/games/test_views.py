import re

import pytest
from django.urls import reverse

from games import catalog


def test_game_list_shows_only_displayed_games(games, client):
    response = client.get(reverse("game_list"))

    assert response.status_code == 200
    content = response.content.decode()
    assert 'href="/game/robots/"' in content
    assert "Tetris" not in content


def test_library_lists_the_games_by_name(client):
    response = client.get(reverse("game_list"))

    shown = [game.name for game in response.context["games"]]
    assert shown == ["Greed", "Hangman", "NetHack", "Robots", "Tetris"]


def test_library_games_have_url_safe_slugs_commands_and_descriptions():
    games = catalog.all_games()

    assert games
    assert all(re.fullmatch(r"[a-z0-9-]+", game.slug) for game in games)
    assert all(game.command and game.description for game in games)


def test_description_renders_markdown(monkeypatch, client):
    game = catalog.Game(
        slug="x", name="X", command="x", description="Press `q` to *quit*.\n\n- one\n- two"
    )
    monkeypatch.setattr(catalog, "all_games", lambda: (game,))

    content = client.get("/game/x/").content.decode()

    assert "<p>Press <code>q</code> to <em>quit</em>.</p>" in content
    assert "<li>one</li>" in content


@pytest.mark.parametrize(
    "markdown, unsafe",
    [
        ("<script>alert(1)</script>", "<script>alert"),
        ('<img src=x onerror="alert(1)">', "<img src=x"),
        ("[click](javascript:alert(1))", 'href="javascript:'),
        ("![x](data:text/html;base64,PHNjcmlwdD4=)", 'src="data:text/html'),
    ],
)
def test_description_markdown_is_safe(markdown, unsafe, monkeypatch, client):
    game = catalog.Game(slug="x", name="X", command="x", description=markdown)
    monkeypatch.setattr(catalog, "all_games", lambda: (game,))

    content = client.get("/game/x/").content.decode()

    assert unsafe not in content


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
    game = catalog.Game(slug="robots", name="Robots", command="robots", refresh_code=12)
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
    game = catalog.Game(slug="x", name="X", command="</script><script>alert(1)")
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


@pytest.mark.parametrize(
    "name, url, text",
    [("main", "/", "surfing alpaca"), ("about", "/about/", "Created by")],
)
def test_pages_render(name, url, text, client):
    assert reverse(name) == url

    response = client.get(url)

    assert response.status_code == 200
    assert text in response.content.decode()
