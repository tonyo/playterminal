from django.views.generic import DetailView, ListView

from games.models import Game


class GameDetailView(DetailView):
    model = Game


class GameListView(ListView):
    model = Game
