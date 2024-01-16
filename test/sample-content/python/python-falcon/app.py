import os
import falcon


class PingResource:
    def on_get(self, req, resp):
        data = {
            "headers": dict(req.headers),
            "environ": dict(os.environ),
            "link": req.relative_uri,
        }

        resp.media = data


app = falcon.API()
app.add_route("/ping", PingResource())
