import os
import time
from flask import Flask, jsonify, request

app = Flask(__name__)
count = 0


@app.route("/")
def index():
    request_id = request.args.get("id")
    delay = int(request.args.get("delay", "0"))
    start_time = time.time()
    while time.time() - start_time < delay:
        pass

    global count
    count += 1

    return jsonify(
        dict(id=request_id, count=count, pid=os.getpid(), timestamp=int(time.time()))
    )


if __name__ == "__main__":
    app.run()
