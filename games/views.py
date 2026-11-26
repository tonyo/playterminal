from django.conf import settings
from django.http import Http404
from django.views.generic import TemplateView

from games import catalog


class GameDetailView(TemplateView):
    template_name = "games/game_detail.html"

    def get_context_data(self, slug, **kwargs):
        game = catalog.get_game(slug)
        if game is None:
            raise Http404(f"No Game {slug!r}")
        game_config = {
            "name": game.name,
            "command": game.command,
            "refreshCode": game.refresh_code,
            "v86Base": settings.V86_BASE_URL,
        }
        return super().get_context_data(game=game, game_config=game_config, **kwargs)


class GameListView(TemplateView):
    template_name = "games/game_list.html"

    def get_context_data(self, **kwargs):
        return super().get_context_data(games=catalog.displayed_games(), **kwargs)


class LicensesView(TemplateView):
    template_name = "games/licenses.html"

    def get_context_data(self, **kwargs):
        return super().get_context_data(v86_base=settings.V86_BASE_URL, **kwargs)
