from django.conf.urls import url
from django.views.generic import TemplateView

from games import views

urlpatterns = [
    url(r'^game/(?P<pk>\d+)/$',
        views.GameDetailView.as_view(), name='game_detail'),
    url(r'^games/$',
        views.GameListView.as_view(), name='game_list'),
    url(r'^about/$',
        TemplateView.as_view(template_name='games/about.html'), name='about'),

]
