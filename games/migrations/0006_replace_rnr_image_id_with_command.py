from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0005_hide_games_except_robots'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='game',
            name='rnr_image_id',
        ),
        migrations.AddField(
            model_name='game',
            name='command',
            field=models.CharField(
                blank=True, default='', max_length=100,
                help_text='The shell command that starts the Game inside the '
                          'VM Image, such as robots. Blank for Games not on '
                          'v86 yet.'),
            preserve_default=False,
        ),
    ]
