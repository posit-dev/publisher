import subprocess
import json
import requests
import time
import os

FUZZBUCKET_URL=os.environ["FUZZBUCKET_URL"]
FUZZBUCKET_CREDENTIALS=os.environ["FUZZBUCKET_CREDENTIALS"]

alias = "perftest-connect-20230518"
box_name = "connect-ci"
list_command = "fuzzbucket-client -j list"
create_command = "fuzzbucket-client create -c " + alias + " -n " + box_name
remove_command = "fuzzbucket-client rm " + box_name

def check_existing_boxes(box_name):
    output = subprocess.check_output(list_command, shell=True, text=True)
    if "\"boxes\": {}" not in output:
        boxes = json.loads(output)
        connect_ip = boxes["boxes"][box_name]["public_ip"]
    else:
        subprocess.check_output(create_command, shell=True, text=True)
        output = subprocess.check_output(list_command, shell=True, text=True)
        boxes = json.loads(output)
        time.sleep(5)
        connect_ip = boxes["boxes"][box_name]["public_ip"]
    return connect_ip

def get_ip(box_name):
    connect_ip = check_existing_boxes(box_name)
    return connect_ip

def connect_ready(box_name, max_attempts, interval):
    connect_box=get_ip(box_name)
    attempts = 0
    while attempts < max_attempts:
        try:
            response = requests.get("http://"+connect_box+":3939/__ping__")
            if response.status_code == 200:
                return response.text
        except requests.RequestException:
            pass

        time.sleep(interval)
        attempts += 1
    return None

response = connect_ready(box_name, 20, 5)

if response:
    print(get_ip(box_name))
else:
    print("Server did not respond after multiple attempts.")