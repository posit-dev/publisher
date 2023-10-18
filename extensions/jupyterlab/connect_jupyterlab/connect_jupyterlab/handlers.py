import errno
import json
import logging
import os
import shlex
import subprocess
from urllib.parse import urlparse
from typing import Set, Dict, Tuple, Any

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from jupyter_server_proxy.handlers import LocalProxyHandler  # type: ignore
from tornado.httpclient import HTTPResponse
from tornado.httputil import HTTPServerRequest
from tornado.web import authenticated

base_url: str = ""
EXECUTABLE = "connect-client"

known_ports: Set[int] = set()
agentsByNotebookPath: Dict[str, Tuple[subprocess.Popen, str]] = {}


class PublishHandler(APIHandler):
    @authenticated
    def post(self) -> None:
        """post initiates the publishing process. Details TBD."""
        self.log.info("Launching publishing UI")
        data: Any = self.get_json_body()
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
            self.set_status(500)
            self.finish(str(exc))


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
    notebookPath: str,
    pythonPath: str,
    pythonVersion: str,
    theme: str,
    log: logging.Logger,
) -> str:
    processInfo = agentsByNotebookPath.get(notebookPath)
    if processInfo is not None:
        process, url = processInfo
        if process.poll() is None:
            # process is still running
            log.info("Found existing agent for %s at %s", notebookPath, url)
            return url
        else:
            # process has exited
            log.info(
                "Previous agent for %s exited with code %d; starting a new one",
                notebookPath,
                process.returncode,
            )
            del agentsByNotebookPath[notebookPath]

    title = os.path.basename(notebookPath)
    for suffix in (".ipynb", ".py"):
        if title.endswith(suffix):
            title = title[: -len(suffix)]

    args = [
        EXECUTABLE,
        "publish-ui",
        notebookPath,
        "--python",
        pythonPath,
        "--python-version",
        pythonVersion,
        "--theme",
        theme,
        "--title",
        title,
        "-n",
        "dogfood",  # cheating, no target selection in the UI yet
    ]
    log.info("Starting: %s", " ".join(map(shlex.quote, args)))
    try:
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=None, text=True)
    except OSError as exc:
        if exc.errno == errno.ENOENT:
            raise Exception(f"Could not find {EXECUTABLE} on PATH.")
        else:
            raise

    if process.stdout is None:
        # This should never happen because we requested stdout=subprocess.PIPE
        raise Exception("The launched process did not provide an output stream.")

    # URL is the first line written to stdout
    url = process.stdout.readline().strip()

    # remember this agent in case of UI refresh
    agentsByNotebookPath[notebookPath] = (process, url)
    parsed = urlparse(url)

    if parsed.port is None:
        # we should always have a port
        raise Exception("The launched process did not bind to a port.")

    known_ports.add(parsed.port)
    return url
