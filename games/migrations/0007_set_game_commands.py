from django.db import migrations

# Commands in the VM Image (playterminal-images). Only Robots is shown;
# the others are filled in so they are ready when they move over.
COMMANDS = {
    'Robots': 'robots',
    'Tetris': 'tetris-bsd',
    'Greed': 'greed',
    'Hangman': 'hangman',
    'NetHack': 'nethack',
}


def set_commands(apps, schema_editor):
    Game = apps.get_model('games', 'Game')
    for name, command in COMMANDS.items():
        Game.objects.filter(name=name, command='').update(command=command)


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0006_replace_rnr_image_id_with_command'),
    ]

    operations = [
        migrations.RunPython(set_commands, migrations.RunPython.noop),
    ]
