import os
from pycnic.core import WSGI, Handler


class Ping(Handler):
    def get(self):
        return {
	        'headers': dict(self.request.headers),
	        'environ': dict(os.environ),
	        'link': self.request.environ.get('SCRIPT_NAME') + self.request.path,
	    }


class app(WSGI):
    routes = [
        ('/ping', Ping())
    ]
