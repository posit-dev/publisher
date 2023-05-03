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

#from connect_publishing.managers import get_model

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
            # the path is relative to the `rsconnect` directory
            src="static",
            # directory in the `nbextension/` namespace
            dest="connect_publishing",
            # _also_ in the `nbextension/` namespace
            require="connect_publishing/index",
        )
    ]


def md5(s):
    if hasattr(s, "encode"):
        s = s.encode("utf-8")

    try:
        h = hashlib.md5()
    except Exception:
        # md5 is not available in FIPS mode, see if the usedforsecurity option is available
        # (it was added in python 3.9). We set usedforsecurity=False since we are only
        # using this for a file upload integrity check.
        h = hashlib.md5(usedforsecurity=False)

    h.update(s)
    return h.hexdigest()


# # https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
# class EndpointHandler(APIHandler):
#     @web.authenticated
#     async def post(self, action):
#         data = self.get_json_body()

#         if action == "verify_server":
#             server_address = data["server_address"]
#             api_key = data["api_key"]
#             disable_tls_check = data["disable_tls_check"]
#             cadata = data.get("cadata", None)

#             canonical_address = None
#             result = None
#             try:
#                 canonical_address, result = test_server(
#                     RSConnectServer(server_address, api_key, disable_tls_check, cadata)
#                 )
#             except SSLError as exc:
#                 if exc.reason == "UNKNOWN_PROTOCOL":
#                     raise web.HTTPError(
#                         400,
#                         'Received an "SSL:UNKNOWN_PROTOCOL" error when trying to connect securely '
#                         + "to the Posit Connect server.\n"
#                         + '* Try changing "https://" in the "Server Address" field to "http://".\n'
#                         + "* If the condition persists, contact your Posit Connect server "
#                         + "administrator.",
#                     )
#                 raise web.HTTPError(
#                     400,
#                     "A TLS error occurred when trying to reach the Posit Connect server.\n"
#                     + "* Ensure that the server address you entered is correct.\n"
#                     + "* Ask your Posit Connect administrator if you need a certificate bundle and\n"
#                     + '  upload it using "Upload TLS Certificate Bundle" below.',
#                 )
#             except Exception as err:
#                 self.log.exception("Unable to verify that the provided server is running Posit Connect")
#                 raise web.HTTPError(
#                     400,
#                     "Unable to verify that the provided server is running Posit Connect: %s" % err,
#                 )
#             if canonical_address is not None:
#                 uri = canonical_address.url
#                 try:
#                     verify_api_key(RSConnectServer(uri, api_key, disable_tls_check, cadata))
#                     address_hash = md5(server_address)
#                     self.finish(
#                         json.dumps(
#                             {
#                                 "status": "Provided server is running Posit Connect",
#                                 "address_hash": address_hash,
#                                 "server_address": canonical_address.url,
#                             }
#                         )
#                     )
#                 except RSConnectException:
#                     raise web.HTTPError(401, "Unable to verify the provided API key")
#             return

#         if action == "app_search":
#             uri = data["server_address"]
#             api_key = data["api_key"]
#             title = data["notebook_title"]
#             app_id = data.get("app_id")
#             disable_tls_check = data["disable_tls_check"]
#             cadata = data.get("cadata", None)

#             try:
#                 server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
#                 retval = override_title_search(server, app_id, title)
#             except RSConnectException as exc:
#                 raise web.HTTPError(400, exc.message)
#             self.finish(json.dumps(retval))
#             return

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

    @web.authenticated
    def get(self, action):
        if action == "plugin_version":
            rsconnect_jupyter_server_extension = __version__
            rsconnect_python_version = VERSION
            self.finish(
                json.dumps(
                    {
                        "rsconnect_jupyter_server_extension": rsconnect_jupyter_server_extension,
                        "rsconnect_python_version": rsconnect_python_version,
                    }
                )
            )


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_publishing enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/rsconnect_jupyter/%s" % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
