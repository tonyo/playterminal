import pytest

from games.models import Game
from games.utils.stepicclient import StepicClient


def pytest_addoption(parser):
    parser.addoption('--login', action='store', default='',
                     help="Stepic user login")
    parser.addoption('--password', action='store', default='',
                     help="Stepic user password")


@pytest.fixture
def login(request):
    return request.config.getoption('login')


@pytest.fixture
def password(request):
    return request.config.getoption('password')


@pytest.fixture
def stepic_client(login, password):
    return StepicClient(login, password)


@pytest.fixture
def game(db):
    return Game.objects.create(step_id=36066, info='yo game')
