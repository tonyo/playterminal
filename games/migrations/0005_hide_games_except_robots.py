# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


def hide_games_except_robots(apps, schema_editor):
    Game = apps.get_model('games', 'Game')
    Game.objects.exclude(name='Robots').update(displayed=False)


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0004_auto_20161106_1507'),
    ]

    operations = [
        migrations.RunPython(hide_games_except_robots,
                             migrations.RunPython.noop),
    ]
