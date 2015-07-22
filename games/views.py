from django.views.generic import DetailView

from games.models import Game


class GameDetailView(DetailView):
    model = Game
