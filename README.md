# playterminal

PlayTerminal is an attempt to bring old-school console gaming back to life. The idea is to create a library of games you can play in a terminal and give an opportunity to run them, ehmm, without a terminal, i.e. right in your browser.

Deployed instance: https://playtermin.al



### Getting started

Dependencies: Python 3

1. Create a virtual environment and install dependencies

  `pip install -r requirements.txt`

2. Create the `secrets.py` file with sensitive information:

  `cp playterminal/settings/secrets.dist.py playterminal/settings/secrets.py`

3. Update SECRET_KEY, ROOTNROLL_USERNAME, etc.

  `vim playterminal/settings/secrets.py` 

4. Run migrations

  `./manage.py migrate`

5. Load initial data

  `./manage.py loaddata seed`

TODO: Ansible docs
