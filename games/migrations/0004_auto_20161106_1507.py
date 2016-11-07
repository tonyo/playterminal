# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0003_game_displayed'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='game',
            name='step_id',
        ),
        migrations.AddField(
            model_name='game',
            name='refresh_code',
            field=models.IntegerField(help_text='An integer, which represents a key code that will be sent to refresh the newly created terminal', blank=True, null=True),
        ),
    ]
