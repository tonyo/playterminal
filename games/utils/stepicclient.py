import json

import requests


STEPIC_URL = 'https://stepic.org/'
STEPIC_API_URL = STEPIC_URL + 'api/'

STEPIC_API_ATTEMPTS_URL = STEPIC_API_URL + 'attempts'
STEPIC_API_ATTEMPT_URL = STEPIC_API_ATTEMPTS_URL + '/{id}'


class LoginError(Exception):
    """An exception raised when login failed."""


class StepicError(Exception):
    """An error occurred on the Stepic side."""


class StepicClient(object):
    def __init__(self, client_id, client_secret):
        # Get a token
        auth = requests.auth.HTTPBasicAuth(client_id, client_secret)
        response = requests.post('https://stepic.org/oauth2/token/',
                                 data={'grant_type': 'client_credentials'},
                                 auth=auth)
        self.token = json.loads(response.text)['access_token']
        self.auth_headers = {'Authorization': 'Bearer ' + self.token}

    def get_attempt(self, attempt_id):
        api_url = STEPIC_API_ATTEMPT_URL.format(id=attempt_id)
        response = requests.get(api_url, headers=self.auth_headers)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        response_data = json.loads(response.text)
        attempt = response_data['attempts'][0]
        return attempt

    def create_attempt(self, step_id):
        data = {'attempt': {'step': step_id}}
        response = requests.post(STEPIC_API_ATTEMPTS_URL, json=data,
                                 headers=self.auth_headers)
        response.raise_for_status()
        resp_json = response.json()
        if not resp_json['attempts']:
            raise StepicError("Stepic didn't return an attempt")
        return resp_json['attempts'][0]
