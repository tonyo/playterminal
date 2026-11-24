from django.db import migrations


def show_nethack(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(name="NetHack").update(displayed=True)


def hide_nethack(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(name="NetHack").update(displayed=False)


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0007_set_game_commands"),
    ]

    operations = [
        migrations.RunPython(show_nethack, hide_nethack),
    ]
