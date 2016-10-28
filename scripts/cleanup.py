"""Remove all terminals"""
import os

os.environ['DJANGO_SETTINGS_MODULE'] = 'playterminal.settings.base'

from games.api import get_rnr_client


c = get_rnr_client()

for s in c.list_servers()['results']:
    c.destroy_server(s)

c.list_servers()
