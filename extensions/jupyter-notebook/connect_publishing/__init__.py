import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web, process

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


# https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
class EndpointHandler(APIHandler):
    @web.authenticated
    async def get(self, action):
        if action == "start_ui":
            process_output = process.Subprocess(
                "just /Users/isabelzimmerman/code/github/publishing-client/web/start",
                shell=True,
                stdout=process.Subprocess.STREAM,
                
            )
            stdout_future = process_output.stdout.read_until_close()
            await stdout_future
            import re

            regex = r"Local:\s*(\S+)"
            stdout = stdout_future.result().decode("utf-8")
            match = re.search(regex, stdout)

            self.finish(
                json.dumps(
                    {
                        "data": match.group(),
                    }
                )
            )


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_publishing enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/connect_publishing/%s" % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
