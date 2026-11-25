from django.contrib.flatpages import views as flatpages_views
from django.urls import path

from games import views

urlpatterns = [
    path("", flatpages_views.flatpage, {"url": "/main/"}, name="main"),
    path("game/<slug:slug>/", views.GameDetailView.as_view(), name="game_detail"),
    path("games/", views.GameListView.as_view(), name="game_list"),
    path("about/", flatpages_views.flatpage, {"url": "/about/"}, name="about"),
    path("licenses/", views.LicensesView.as_view(), name="licenses"),
]
