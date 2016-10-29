#!/usr/bin/env python
"""Remove all terminals"""
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(SCRIPT_DIR, os.pardir))
os.environ['DJANGO_SETTINGS_MODULE'] = 'playterminal.settings.base'

from games.api import get_rnr_client


c = get_rnr_client()

for s in c.list_servers()['results']:
    c.destroy_server(s)

c.list_servers()
