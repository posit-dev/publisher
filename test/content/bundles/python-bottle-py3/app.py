import json
import os

from bottle import Bottle, request

app = Bottle()

@app.route('/ping', name='ping')
def ping():
    return {
        'headers': dict(request.headers),
        'environ': dict(os.environ),
        'link': app.get_url('ping'),
    }

if __name__ == '__main__':
    app.run(host='localhost', port=8080)
