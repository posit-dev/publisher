from ._version import __version__
from .handlers import setup_handlers

PACKAGE_NAME = "connect_jupyterlab"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": PACKAGE_NAME}]


def _jupyter_server_extension_points():
    return [{"module": PACKAGE_NAME}]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    setup_handlers(server_app.web_app)
    server_app.log.info(f"Registered {PACKAGE_NAME} server extension, version {__version__}")
