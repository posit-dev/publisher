import json
import logging
import os
import shlex
import subprocess
from urllib.parse import urlparse

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from jupyter_server_proxy.handlers import LocalProxyHandler  # type: ignore
from tornado.httputil import HTTPServerRequest
from tornado.web import authenticated
from tornado.httpclient import HTTPResponse

base_url = None
known_ports = {}


class PublishHandler(APIHandler):
    @authenticated
    def post(self) -> None:
        """post initiates the publishing process. Details TBD."""
        self.log.info("Launching publishing UI")
        data = self.get_json_body()
        notebookPath = os.path.abspath(data["notebookPath"])
        pythonPath = data["pythonPath"]
        pythonVersion = data["pythonVersion"]
        theme = data["theme"]

        try:
            ui_url = launch_ui(notebookPath, pythonPath, pythonVersion, theme, self.log)
            parsed = urlparse(ui_url)
            proxy_path = url_path_join(base_url, "ui", str(parsed.port), "/")
            req = self.request
            ui_url = parsed._replace(
                scheme=req.protocol, netloc=req.host, path=proxy_path
            ).geturl()

            self.log.info("Publishing UI url: %s", ui_url)
            self.finish(json.dumps({"url": ui_url}))
        except Exception as exc:
            self.log.exception("UI launch failed", exc_info=exc)
            self.set_status(500, str(exc))

    @authenticated
    def get(self) -> None:
        """get returns the status of the publishing process. Details TBD."""
        self.finish(json.dumps({"data": "GET /connect-jupyterlab/publish endpoint!"}))


class UIHandler(LocalProxyHandler):
    """UIHandler proxies requests to a running agent instance.

    Proxied paths are /connect-jupyterlab/ui/{port}/*.
    This handler verifies that the port belongs to one of
    the agents we launched.
    """

    def __init__(self, *args, **kw):
        kw["rewrite_response"] = UIHandler.rewrite
        super().__init__(*args, **kw)

    @staticmethod
    def rewrite(request: HTTPServerRequest, response: HTTPResponse):
        # rewrite the auth redirect from the agent
        # This doesn't handle arbitrary redirects.
        loc = response.headers.get("Location")
        if loc is not None:
            response.headers["Location"] = request.path

        # scope any cookies to this app's path
        cookie = response.headers.get("Set-Cookie")
        if cookie is not None:
            base_path = "/".join(request.path.split("/")[:4])
            response.headers["Set-Cookie"] = f"{cookie}; Path={base_path}"

    def proxy(self, port, proxied_path):
        if int(port) not in known_ports:
            self.set_status(400, "Invalid proxy path")
            self.finish()
            return
        return super().proxy(port, proxied_path)


def setup_handlers(web_app):
    host_pattern = ".*$"

    global base_url
    base_url = url_path_join(web_app.settings["base_url"], "connect-jupyterlab")
    route_pattern = url_path_join(base_url, "publish")
    ui_pattern = url_path_join(base_url, "ui", r"(\d+)", r"(.*)")

    handlers = [
        (route_pattern, PublishHandler),
        (ui_pattern, UIHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)


def launch_ui(
    notebookPath: str, pythonPath: str, pythonVersion: str, theme: str, log: logging.Logger
) -> str:
    args = [
        "connect-client",
        "publish-ui",
        notebookPath,
        "--python",
        pythonPath,
        "--python-version",
        pythonVersion,
        "--theme",
        theme,
        "-n",
        "local",  # cheating, no target selection in the UI yet
    ]
    log.info("Starting: %s", " ".join(map(shlex.quote, args)))
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=None, text=True)

    if process.stdout is None:
        # This should never happen because we requested stdout=subprocess.PIPE
        raise Exception("The launched process did not provide an output stream.")
    # currently, URL is the first thing written to stdout
    url = process.stdout.readline().strip()

    parsed = urlparse(url)
    known_ports[parsed.port] = process
    return url
