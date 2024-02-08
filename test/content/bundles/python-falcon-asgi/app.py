import os
from falcon.asgi import App


class PingResource:
    async def on_get(self, req, resp):
        data = {
            "headers": dict(req.headers),
            "environ": dict(os.environ),
            "link": req.relative_uri,
        }

        resp.media = data


app = App()
app.add_route("/ping", PingResource())
# app.add_route("/", PingResource())
