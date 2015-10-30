# playterminal

1. Install dependencies

  `pip install -r requirements.txt`

2. Create the `secrets.py` file with sensitive information:

  `cp playterminal/settings/secrets.dist.py playterminal/settings/secrets.py`

3. Update SECRET_KEY, STEPIC_CLIENT_ID, etc.

  `vim playterminal/settings/secrets.py` 

4. Run migrations

  `./manage.py migrate`

5. Load initial data

  `./manage.py loaddata seed`
