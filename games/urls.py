from django.conf.urls import url
from games import views

urlpatterns = [
    url(r'^game/(?P<pk>\d+)/$',
        views.GameDetailView.as_view(), name='game_detail'),
    url(r'^games/$',
        views.GameListView.as_view(), name='game_list'),
]
