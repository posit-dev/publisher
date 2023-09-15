import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class RouteHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        """post initiates the publishing process. Details TBD."""
        self.finish(json.dumps({"data": "POST /connect-jupyterlab/publish endpoint!"}))

    @tornado.web.authenticated
    def get(self):
        """get returns the status of the publishing process. Details TBD."""
        self.finish(json.dumps({"data": "GET /connect-jupyterlab/publish endpoint!"}))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "connect-jupyterlab", "publish")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
