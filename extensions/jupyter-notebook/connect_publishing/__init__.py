from notebook.utils import url_path_join
from tornado import web

from rsconnect import VERSION

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

def load_jupyter_server_extension(nb_app):
    nb_app.log.info("connect_publishing enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/connect_publishing/%s" % action_pattern)
