from django.conf import settings
from django.views.generic import DetailView, ListView, TemplateView

from games.models import Game


class GameDetailView(DetailView):
    model = Game

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["game_config"] = {
            "id": self.object.id,
            "command": self.object.command,
            "refreshCode": self.object.refresh_code,
            "v86Base": settings.V86_BASE_URL,
        }
        return context


class GameListView(ListView):
    model = Game

    def get_queryset(self):
        return super().get_queryset().filter(displayed=True)


class LicensesView(TemplateView):
    template_name = "games/licenses.html"

    def get_context_data(self, **kwargs):
        return super().get_context_data(v86_base=settings.V86_BASE_URL, **kwargs)
