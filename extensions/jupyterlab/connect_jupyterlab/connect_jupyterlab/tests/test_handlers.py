import errno
import json
import subprocess
from unittest.mock import Mock, patch

from connect_jupyterlab import handlers


async def test_get_publish(jp_fetch):
    response = await jp_fetch("connect-jupyterlab", "publish")

    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {"data": "GET /connect-jupyterlab/publish endpoint!"}


@patch("connect_jupyterlab.handlers.launch_ui")
async def test_post_publish(launch_ui, jp_fetch, jp_serverapp, jp_http_port, jp_base_url):
    body = json.dumps(
        {
            "notebookPath": "notebooks/MyNotebook.ipynb",
            "pythonPath": "/path/to/python",
            "pythonVersion": "3.4.5",
            "theme": "dark",
        }
    )
    launch_ui.return_value = "http://localhost:12345/?token=abc123"
    response = await jp_fetch("connect-jupyterlab", "publish", method="POST", body=body)

    assert response.code == 200
    payload = json.loads(response.body)
    expected_url = (
        f"http://127.0.0.1:{jp_http_port}{jp_base_url}connect-jupyterlab/ui/12345/?token=abc123"
    )
    assert payload == {"url": expected_url}


@patch("connect_jupyterlab.handlers.launch_ui")
async def test_post_publish_err(launch_ui, jp_fetch, jp_serverapp, jp_http_port, jp_base_url):
    body = json.dumps(
        {
            "notebookPath": "notebooks/MyNotebook.ipynb",
            "pythonPath": "/path/to/python",
            "pythonVersion": "3.4.5",
            "theme": "dark",
        }
    )
    err = "test error"
    launch_ui.side_effect = Exception(err)
    response = await jp_fetch(
        "connect-jupyterlab", "publish", method="POST", body=body, raise_error=False
    )

    assert response.code == 500
    assert response.body == err.encode("utf-8")


@patch("subprocess.Popen")
async def test_launch_ui(popen):
    log = Mock()
    log.info = Mock()

    process = Mock()
    process.stdout = Mock()
    process.stdout.readline = Mock()
    ui_url = "http://localhost:12345/?token=abc123"
    process.stdout.readline.return_value = "http://localhost:12345/?token=abc123"

    popen.return_value = process

    url = handlers.launch_ui("notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log)
    log.info.assert_called()
    popen.assert_called_once_with(
        [
            "connect-client",
            "publish-ui",
            "notebooks/MyNotebook.ipynb",
            "--python",
            "/path/to/python",
            "--python-version",
            "3.4.5",
            "--theme",
            "dark",
            "-n",
            "local",
        ],
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
    )
    assert url == ui_url


@patch("subprocess.Popen")
async def test_launch_ui_no_executable(popen):
    log = Mock()
    log.info = Mock()

    err = OSError()
    err.errno = errno.ENOENT
    popen.side_effect = err

    try:
        handlers.launch_ui("notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log)
    except Exception as exc:
        assert str(exc) == "Could not find connect-client on PATH."


@patch("subprocess.Popen")
async def test_launch_ui_err(popen):
    log = Mock()
    log.info = Mock()

    err = OSError()
    popen.side_effect = err

    try:
        handlers.launch_ui("notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log)
    except Exception as exc:
        assert exc == err
