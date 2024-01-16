import os

from flask import Flask, request, url_for
from flask_restful import Resource, Api

app = Flask(__name__)
api = Api(app)


class HelloWorld(Resource):
    def get(self):
        return {
            "headers": dict(request.headers),
            "environ": dict(os.environ),
            "link": url_for("hello"),
            "external_link": url_for("hello", _external=True),
        }


api.add_resource(HelloWorld, "/", endpoint="hello")

if __name__ == "__main__":
    app.run(debug=True)
