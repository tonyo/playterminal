import pytest

from games.models import Game


@pytest.fixture
def game(db):
    return Game.objects.create(name="Robots", info="yo game", displayed=True)
