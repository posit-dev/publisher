import errno
import json
import subprocess
from unittest.mock import Mock, patch

import jupyter_server_proxy  # type: ignore
from tornado.httputil import HTTPHeaders, HTTPServerRequest
from tornado.httpclient import HTTPRequest, HTTPResponse

from connect_jupyterlab import handlers


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
    handlers.agentsByNotebookPath = {}
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
            "publisher",
            "ui",
            "notebooks",
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
        assert str(exc) == "Could not find publisher on PATH."


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


@patch("connect_jupyterlab.handlers.launch_ui")
@patch.object(jupyter_server_proxy.handlers.LocalProxyHandler, "proxy")
async def test_proxy(proxy, launch_ui, jp_fetch):
    launch_ui.return_value = "http://localhost:12345/?token=abc123"

    async def proxy_response(port, proxied_path):
        assert port == "12345"
        assert proxied_path == "index.html"

    proxy.side_effect = proxy_response
    response = await jp_fetch("connect-jupyterlab", "ui", "12345", "index.html")
    assert response.code == 200


async def test_proxy_invalid_path(jp_fetch):
    response = await jp_fetch("connect-jupyterlab", "ui", "44444", "index.html", raise_error=False)
    assert response.code == 400


def test_rewrite_redirect():
    uri = "/connect-jupyterlab/ui/12345/?token=abc123"
    req = HTTPServerRequest("GET", uri)
    resp = HTTPResponse(HTTPRequest(uri), code=301, headers=HTTPHeaders(dict(Location="/")))
    handlers.UIHandler.rewrite(req, resp)
    assert resp.headers["Location"] == "/connect-jupyterlab/ui/12345/"


def test_rewrite_cookie():
    uri = "/connect-jupyterlab/ui/12345/index.html"
    req = HTTPServerRequest("GET", uri)
    resp = HTTPResponse(
        HTTPRequest(uri), code=200, headers=HTTPHeaders({"Set-Cookie": "session=my-session"})
    )
    handlers.UIHandler.rewrite(req, resp)
    assert resp.headers["Set-Cookie"] == "session=my-session; Path=/connect-jupyterlab/ui/12345"


@patch("subprocess.Popen")
async def test_launch_ui_reuse_agent(popen):
    handlers.agentsByNotebookPath = {}
    log = Mock()
    log.info = Mock()

    process = Mock()
    process.stdout = Mock()
    process.stdout.readline = Mock()
    process.poll.return_value = None

    ui_url = "http://localhost:12345/?token=abc123"
    process.stdout.readline.return_value = "http://localhost:12345/?token=abc123"

    popen.return_value = process

    url = handlers.launch_ui("notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log)
    url2 = handlers.launch_ui(
        "notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log
    )
    log.info.assert_called()

    # only one process is launched
    popen.assert_called_once_with(
        [
            "publisher",
            "ui",
            "notebooks",
        ],
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
    )
    assert url == ui_url
    assert url2 == ui_url


@patch("subprocess.Popen")
async def test_launch_ui_cant_reuse_agent(popen):
    handlers.agentsByNotebookPath = {}
    log = Mock()
    log.info = Mock()

    process = Mock()
    process.stdout = Mock()
    process.stdout.readline = Mock()
    ui_url = "http://localhost:12345/?token=abc123"
    process.stdout.readline.return_value = ui_url

    # process has exited
    process.poll.return_value = 1
    popen.return_value = process

    # now call launch_ui twice
    url = handlers.launch_ui("notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log)

    process2 = Mock()
    process2.stdout = Mock()
    process2.stdout.readline = Mock()
    ui_url2 = "http://localhost:54321/?token=321bca"
    process2.stdout.readline.return_value = ui_url2
    popen.return_value = process2

    url2 = handlers.launch_ui(
        "notebooks/MyNotebook.ipynb", "/path/to/python", "3.4.5", "dark", log
    )

    # two processes are launched
    log.info.assert_called()
    assert len(popen.call_args_list) == 2
    popen.assert_called_with(
        [
            "publisher",
            "ui",
            "notebooks",
        ],
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
    )
    assert url == ui_url
    assert url2 == ui_url2
