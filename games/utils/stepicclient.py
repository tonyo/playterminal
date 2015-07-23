import json
import logging

import requests


logger = logging.getLogger(__name__)


STEPIC_URL = 'https://stepic.org/'
STEPIC_API_URL = STEPIC_URL + 'api/'

STEPIC_LOGIN_URL = STEPIC_URL + 'accounts/login/'


class LoginError(Exception):
    """An exception raised when login failed."""


class StepicClient(object):
    def __init__(self, login, password):
        self.login = login
        self.password = password
        self.headers = {'Content-Type': 'application/json'}
        self.session = requests.Session()
        self.session.headers.update({'Referer': STEPIC_URL})
        self._is_logged_in = False

    def _request(self, method, url, **kwargs):
        logger.debug("StepicClient request: %s %s | body: %s",
                     method.upper(), url, kwargs.get('data'))
        if 'data' in kwargs:
            kwargs['data'] = json.dumps(kwargs['data'])

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
        self.session.get(STEPIC_URL)
        data = {
            'csrfmiddlewaretoken': self.session.cookies['csrftoken'],
            'login': self.login,
            'password': self.password,
            'remember': 'on',
        }
        res = self._request('GET', STEPIC_LOGIN_URL,
                            data=data, allow_redirects=False)
        if res.status_code != 302:
            raise LoginError()
        self._is_logged_in = True
