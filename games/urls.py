from django.urls import path
from django.views.generic import TemplateView

from games import views

urlpatterns = [
    path("", TemplateView.as_view(template_name="games/main.html"), name="main"),
    path("game/<slug:slug>/", views.GameDetailView.as_view(), name="game_detail"),
    path("games/", views.GameListView.as_view(), name="game_list"),
    path("about/", TemplateView.as_view(template_name="games/about.html"), name="about"),
    path("licenses/", views.LicensesView.as_view(), name="licenses"),
]
