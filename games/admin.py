from django.contrib import admin
from django.contrib.admin import ModelAdmin

from games.models import Game


class GameAdmin(ModelAdmin):
    list_display = ('name', 'command', 'displayed')

admin.site.register(Game, GameAdmin)
