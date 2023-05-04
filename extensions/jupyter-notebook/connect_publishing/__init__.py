import hashlib
import json
import os
import sys

from six.moves.urllib.parse import unquote_plus
from os.path import dirname

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

from rsconnect import VERSION
from rsconnect.actions import test_server
from rsconnect.api import (
    RSConnect,
    RSConnectException,
    RSConnectServer,
    override_title_search,
    verify_api_key,
)
from rsconnect.bundle import (
    make_notebook_html_bundle,
    make_notebook_source_bundle,
    make_voila_bundle,
    write_manifest,
)
from rsconnect.environment import Environment
from rsconnect.http_support import CookieJar

from ssl import SSLError

try:
    from connect_publishing.version import version as __version__  # noqa
except ImportError:
    __version__ = "NOTSET"  # noqa


def _jupyter_server_extension_paths():
    return [{"module": "connect_publishing"}]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [
        dict(
            section="notebook",
            # the path is relative to the `connect_publishing` directory
            src="static",
            # directory in the `nbextension/` namespace
            dest="connect_publishing",
            # _also_ in the `nbextension/` namespace
            require="connect_publishing/index",
        )
    ]


# def md5(s):
#     if hasattr(s, "encode"):
#         s = s.encode("utf-8")

#     try:
#         h = hashlib.md5()
#     except Exception:
#         # md5 is not available in FIPS mode, see if the usedforsecurity option is available
#         # (it was added in python 3.9). We set usedforsecurity=False since we are only
#         # using this for a file upload integrity check.
#         h = hashlib.md5(usedforsecurity=False)

#     h.update(s)
#     return h.hexdigest()


# # https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
# class EndpointHandler(APIHandler):
#     @web.authenticated
#     async def post(self, action):
#         data = self.get_json_body()

#         if action == "get_python_settings":
#             uri = data["server_address"]
#             api_key = data["api_key"]
#             disable_tls_check = data["disable_tls_check"]
#             cadata = data.get("cadata", None)

#             try:
#                 server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
#                 with RSConnect(server) as api_client:
#                     retval = api_client.python_settings()
#                 server.handle_bad_response(retval)
#             except RSConnectException as exc:
#                 raise web.HTTPError(400, exc.message)
#             self.finish(json.dumps(retval))
#             return

#     @web.authenticated
#     def get(self, action):
#         if action == "plugin_version":
#             connect_publishing_server_extension = __version__
#             rsconnect_python_version = VERSION
#             self.finish(
#                 json.dumps(
#                     {
#                         "connect_publishing server extension version": connect_publishing_server_extension,
#                         "rsconnect_python version": rsconnect_python_version,
#                     }
#                 )
#             )


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_publishing enabled! version: ", __version__)
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/connect_publishing/%s" % action_pattern)
    #web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
