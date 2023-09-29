import json


async def test_get_publish(jp_fetch):
    # When
    response = await jp_fetch("connect-jupyterlab", "publish")

    # Then
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {"data": "GET /connect-jupyterlab/publish endpoint!"}
