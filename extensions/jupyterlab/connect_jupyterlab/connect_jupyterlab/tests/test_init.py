from .. import (
    _jupyter_labextension_paths,
    _jupyter_server_extension_points,
    PACKAGE_NAME,
)


def test_jupyter_labextension_paths():
    result = _jupyter_labextension_paths()
    assert len(result) == 1
    path = result[0]
    assert path["src"] == "labextension"
    assert path["dest"] == PACKAGE_NAME


def test_jupyter_server_extension_points():
    result = _jupyter_server_extension_points()
    assert len(result) == 1
    path = result[0]
    assert path["module"] == PACKAGE_NAME
