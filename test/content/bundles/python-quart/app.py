import os

from quart import Quart, jsonify, request, url_for

app = Quart(__name__)


@app.route("/ping")
async def ping():
    return jsonify(
        {
            "headers": dict(request.headers),
            "environ": dict(os.environ),
            "link": url_for("ping"),
            "external_link": url_for("ping", _external=True),
        }
    )


@app.route("/fail")
async def fail():
    raise AssertionError("test error")


if __name__ == "__main__":
    app.run(port=5000)
