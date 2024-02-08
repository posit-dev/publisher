import os
from sanic import Sanic
from sanic.response import json

app = Sanic(__name__)


@app.route("/ping")
async def ping(request):
    data = {
        "headers": dict(request.headers),
        "environ": dict(os.environ),
    }
    return json(data)


if __name__ == "__main__":
    app.run()
