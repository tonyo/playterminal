"""Remove all terminals"""

from games.api import get_rnr_client
c = get_rnr_client()

for s in c.list_servers()['results']:
    c.destroy_server(s)

c.list_servers()
