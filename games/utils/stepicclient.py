import json
import logging

import requests


logger = logging.getLogger(__name__)


STEPIC_URL = 'https://stepic.org/'
STEPIC_API_URL = STEPIC_URL + 'api/'

STEPIC_LOGIN_URL = STEPIC_URL + 'accounts/login/'
STEPIC_API_ATTEMPTS_URL = STEPIC_API_URL + 'attempts'


class LoginError(Exception):
    """An exception raised when login failed."""


class StepicError(Exception):
    """An error occurred on the Stepic side."""


class StepicClient(object):
    def __init__(self, login, password):
        self.login = login
        self.password = password
        self.session = requests.Session()
        headers = {
            'Content-Type': 'application/json',
            'Referer': STEPIC_URL,
        }
        self.session.headers.update(headers)
        self._is_logged_in = False

    def _request(self, method, url, is_json=True, **kwargs):
        logger.debug("StepicClient request: %s %s | body: %s",
                     method.upper(), url, kwargs.get('data'))
        if is_json and 'data' in kwargs:
            kwargs['data'] = json.dumps(kwargs['data'])
        if not is_json:
            headers = kwargs.get('headers', {})
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
            kwargs['headers'] = headers

        res = self.session.request(method, url, **kwargs)
        if not res:
            logger.info("StepicClient response: %s %s on request: %s %s | "
                        "body: %s", res.status_code, res.content,
                        method.upper(), url, kwargs.get('data'))
        else:
            logger.debug("StepicClient response: %s %s on request: %s %s",
                         res.status_code, res.content, method.upper(), url)
        return res

    def _login(self):
        self._request('GET', STEPIC_URL)
        data = {
            'csrfmiddlewaretoken': self.session.cookies['csrftoken'],
            'login': self.login,
            'password': self.password,
            'remember': 'on',
        }
        res = self._request('POST', STEPIC_LOGIN_URL,
                            data=data, is_json=False, allow_redirects=False)
        if res.status_code != 302:
            raise LoginError()
        self._is_logged_in = True

    def create_attempt(self, step_id):
        if not self._is_logged_in:
            self._login()
        extra_headers = {'X-CSRFToken': self.session.cookies['csrftoken']}
        data = {'attempt': {'step': step_id}}
        res = self._request('POST', STEPIC_API_ATTEMPTS_URL,
                            headers=extra_headers, data=data)
        res.raise_for_status()
        res_json = res.json()
        if not res_json['attempts']:
            raise StepicError("Stepic didn't return an attempt")
        return res_json['attempts'][0]
