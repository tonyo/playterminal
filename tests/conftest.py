from unittest.mock import MagicMock

import pytest

import rootnroll
from django.conf import settings

from games.models import Game
from games.utils.stepic_client import StepicClient


@pytest.fixture
def login(request):
    return request.config.getoption('login')


@pytest.fixture
def password(request):
    return request.config.getoption('password')


@pytest.fixture
def stepic_client():
    return StepicClient(settings.STEPIC_CLIENT_ID,
                        settings.STEPIC_CLIENT_SECRET)


@pytest.fixture
def game(db):
    return Game.objects.create(step_id=36066, info='yo game',
                               rnr_image_id=9)


@pytest.fixture
def rootnroll_client():
    return rootnroll.RootnRollClient(username=settings.ROOTNROLL_USERNAME,
                                     password=settings.ROOTNROLL_PASSWORD,
                                     api_url='https://rootnroll.com/api')


@pytest.fixture
def fake_rootnroll_client(mocker):
    mocked_rnr_client = mocker.patch('games.api.RootnRollClient').return_value
    fake_server = {'id': '123'}
    fake_terminal = {'id': '234',
                     'config': {'kaylee_url': 'https://ku/api'}}
    mocked_rnr_client.create_server = MagicMock(return_value=fake_server)
    mocked_rnr_client.get_server = MagicMock(
        return_value={'id': fake_server['id'], 'status': 'ACTIVE'}
    )
    mocked_rnr_client.create_terminal = MagicMock(return_value=fake_terminal)
    mocked_rnr_client.get_terminal = MagicMock(return_value=fake_terminal)
    return mocked_rnr_client
