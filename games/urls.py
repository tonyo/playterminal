from django.conf.urls import url
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.contrib.flatpages import views as flatpages_views

from games import views
from games.api import terminals

urlpatterns = [
    url(r'^$', lambda _: HttpResponseRedirect(reverse('main'))),
    url(r'^game/(?P<pk>\d+)/$',
        views.GameDetailView.as_view(), name='game_detail'),
    url(r'^games/$',
        views.GameListView.as_view(), name='game_list'),
    url(r'^main/$',
        flatpages_views.flatpage, {'url': '/main/'}, name='main'),
    url(r'^about/$',
        flatpages_views.flatpage, {'url': '/about/'}, name='about'),

    # API
    url(r'^api/terminals/$',
        terminals, name='terminals'),
]
