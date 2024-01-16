import json
from flask import Flask, jsonify
from flasgger import Swagger

app = Flask(__name__)
app.config["SWAGGER"] = {"title": "Greetings API"}
db = json.load(open("greetings.json"))
Swagger(app)


@app.route("/greetings/")
def list():
    return jsonify([{"lang": lang, "text": text} for lang, text in sorted(db.items())])


@app.route("/greetings/<lang>/")
def get(lang):
    return jsonify({"lang": lang, "text": db.get(lang)})
