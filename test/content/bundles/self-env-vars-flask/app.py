# rsconnect add -i --server https://dev-password.localtest.me/ --name dev-password --api-key c7achTdggWVGtr851azThcyYDwH5JRgf
# unset CONNECT_SERVER
# rsconnect deploy api -n dev-password .

# Testing locally:
# export FLASK_APP=app.py
# python -m flask run

from os import environ
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
  product = environ.get('RSTUDIO_PRODUCT', 'environment variable not defined')
  guid = environ.get('CONNECT_CONTENT_GUID', 'environment variable not defined')

  return 'RSTUDIO_PRODUCT=%s, CONNECT_CONTENT_GUID=%s' % (product, guid)
