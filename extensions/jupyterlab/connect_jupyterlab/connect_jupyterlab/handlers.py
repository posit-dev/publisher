import json
import logging
import os
import shlex
import subprocess

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado.web import authenticated


class RouteHandler(APIHandler):
    @authenticated
    def post(self):
        """post initiates the publishing process. Details TBD."""
        self.log.info("Launching publishing UI")
        data = self.get_json_body()
        notebookPath = os.path.abspath(data["notebookPath"])
        pythonPath = data["pythonPath"]
        pythonVersion = data["pythonVersion"]

        try:
            url = launch_ui(notebookPath, pythonPath, pythonVersion, self.log)
            self.log.info("Publishing UI url: %s", url)
            self.finish(json.dumps({"url": url}))
        except Exception as exc:
            self.log.exception("UI launch failed", exc_info=exc)
            self.set_status(500, str(exc))

    @authenticated
    def get(self):
        """get returns the status of the publishing process. Details TBD."""
        self.finish(json.dumps({"data": "GET /connect-jupyterlab/publish endpoint!"}))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "connect-jupyterlab", "publish")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)


def launch_ui(notebookPath: str, pythonPath: str, pythonVersion: str, log: logging.Logger) -> str:
    args = [
        "connect-client",
        "publish-ui",
        notebookPath,
        "--python",
        pythonPath,
        "--python-version",
        pythonVersion,
        "-n",
        "local",  # cheating, no target selection in the UI yet
    ]
    log.info("Starting: %s", " ".join(map(shlex.quote, args)))
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=None, text=True)
    # currently, URL is the first thing written to stdout
    url = process.stdout.readline().strip()
    return url
