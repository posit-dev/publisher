import json
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import os
import shlex
from tornado import web
import subprocess

try:
    from connect_jupyternb.version import version as __version__  # noqa
except ImportError:
    __version__ = "NOTSET"  # noqa


def _jupyter_server_extension_paths():
    return [{"module": "connect_jupyternb"}]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [
        dict(
            section="notebook",
            # the path is relative to the `connect_publishing` directory
            src="static",
            # directory in the `nbextension/` namespace
            dest="connect_jupyternb",
            # _also_ in the `nbextension/` namespace
            require="connect_jupyternb/index",
        )
    ]


# https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
class EndpointHandler(APIHandler):
    @web.authenticated
    async def post(self, action):
        if action == "start_ui":
            try:
                data = self.get_json_body()
                pythonPath = data["python"]
                notebookPath = os.path.abspath(data["notebook"])

                args = [
                    "connect-client",
                    "publish-ui",
                    notebookPath,
                    "--python",
                    pythonPath,
                ]
                self.log.info("Starting: %s", " ".join(map(shlex.quote, args)))
                process = subprocess.Popen(
                    args, stdout=subprocess.PIPE, stderr=None, text=True
                )
                # currently, URL is the first thing written to stdout
                ui_url = process.stdout.readline().strip()
                self.log.info("UI url: %s", ui_url)
                self.finish(json.dumps({"ui_url": ui_url}))
            except Exception as exc:
                self.log.exception("UI launch failed", exc_info=exc)
                self.set_status(500, str(exc))


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_jupyternb enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(
        web_app.settings["base_url"], r"/connect_jupyternb/%s" % action_pattern
    )
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
