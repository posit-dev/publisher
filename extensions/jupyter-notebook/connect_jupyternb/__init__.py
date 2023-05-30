import json
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
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
    async def get(self, action):
        if action == "start_ui":
            nb_url = '../connect/examples/stock-report-jupyter' # find url
            account = 'local' # which account? is there a default?
            args = ['/Users/isabelzimmerman/code/github/publishing-client/bin/darwin-arm64/connect-client', 'publish-ui', nb_url, '-n', account]
            
            process = subprocess.Popen(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            while True:
                chunk = process.stdout.readline().strip() # currently, URL is the onnly thing returned in stdout
                break
                # pattern = r'http://\[[^\]]+\]/proxy/local/\?token=[^ ]+'
                # match = re.search(pattern, chunk)
                # if match:
                #     url = match.group()
                #     print(url)
                #     break

            else: 
                raise AttributeError("url not found")
            self.finish(
                json.dumps(
                    {
                        "data": chunk,
                    }
                )
            )

def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_jupyternb enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/connect_jupyternb/%s" % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
