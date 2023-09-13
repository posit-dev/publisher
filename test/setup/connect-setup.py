import hashlib
import subprocess
import json
import requests
import time
import logging

# use the perftest fuzzbucket instance since it already has all the deps
alias = "perftest-connect-20230518"
box_name = "connect-ci"
list_command = "fuzzbucket-client -j list"
create_command = "fuzzbucket-client create -c " + alias + " -n " + box_name
remove_command = "fuzzbucket-client rm " + box_name
ssh_options = "-i.fuzzbucket-ssh-key"

# connect_version =   $(curl https://cdn.posit.co/connect/latest-packages.json | 
#     jq ".packages[0].version")


def get_api_key(username):
    # Calculate the MD5 hash for the username to get an API Key
    api_key = hashlib.md5(username.encode()).hexdigest()
    return api_key

def get_latest_connect_version():
    response = requests.get("https://cdn.posit.co/connect/latest-packages.json")
    latest_connect = response.json()['packages'][0]['version']
    return latest_connect

def get_current_connect_version(connect_ip, api_key):
    response = requests.get(
        'http://' + connect_ip + ':3939/__api__/server_settings',
        headers={'Authorization': 'Key ' + api_key},
        )
    current_connect = response.json()['version']
    return current_connect

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
            logging.info("Checking Connect Status")
            response = requests.get("http://"+connect_box+":3939/__ping__")
            if response.status_code == 200:
                if latest_connect != get_current_connect_version(get_ip(box_name), api_key):
                    logging.info("Installing Connect on " + connect_box)
                    subprocess.check_output(install_connect, shell=True, text=True)
                return response.text
        except requests.RequestException:
            pass

        time.sleep(interval)
        attempts += 1
    return None

api_key=get_api_key('admin')
latest_connect=get_latest_connect_version()
install_connect = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ubuntu@" + get_ip(box_name) + " " + ssh_options + " sudo -E UNATTENDED=1 bash installer-ci.sh " + latest_connect

response = connect_ready(box_name, 20, 5)

if response:
    print(get_ip(box_name))
else:
    print("Server did not respond after multiple attempts.")