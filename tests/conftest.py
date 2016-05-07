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
