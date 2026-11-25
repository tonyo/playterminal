from django.db import migrations

# The main and about pages moved from flatpages to templates, and nothing else used
# django.contrib.sites: both apps left INSTALLED_APPS, so drop their tables and their
# migration records here.
DROP = """
DROP TABLE IF EXISTS django_flatpage_sites;
DROP TABLE IF EXISTS django_flatpage;
DROP TABLE IF EXISTS django_site;
DELETE FROM django_migrations WHERE app IN ('flatpages', 'sites');
"""


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0009_delete_game"),
    ]

    operations = [
        migrations.RunSQL(DROP, migrations.RunSQL.noop),
    ]
