import pytest

from games import catalog


@pytest.fixture
def games(monkeypatch):
    """Replace the Games in games.toml with Robots (listed) and Tetris (not listed)."""
    robots = catalog.Game(
        slug="robots", name="Robots", info="yo game", command="robots", displayed=True
    )
    tetris = catalog.Game(slug="tetris", name="Tetris", info="hidden", command="tetris-bsd")
    monkeypatch.setattr(catalog, "all_games", lambda: (robots, tetris))
    return robots, tetris


@pytest.fixture
def game(games):
    return games[0]
