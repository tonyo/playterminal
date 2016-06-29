# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0002_game_rnr_image_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='game',
            name='displayed',
            field=models.BooleanField(default=False),
        ),
    ]
