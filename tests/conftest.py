import pytest

from games import catalog


@pytest.fixture
def games(monkeypatch):
    """Replace the Games in the library with Robots (listed) and Tetris (not listed)."""
    robots = catalog.Game(
        slug="robots", name="Robots", description="yo game", command="robots", displayed=True
    )
    tetris = catalog.Game(slug="tetris", name="Tetris", description="hidden", command="tetris-bsd")
    monkeypatch.setattr(catalog, "all_games", lambda: (robots, tetris))
    return robots, tetris


@pytest.fixture
def game(games):
    return games[0]
