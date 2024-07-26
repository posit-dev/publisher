import hashlib
import subprocess
import json
import requests
import time
import logging
import os

# use the perftest fuzzbucket instance since it already has all the deps
alias = "ubuntu22-publishing-client-2024.05"
box_name = "connect-publishing-client"
list_command = "fuzzbucket-client -j list"
create_command = "fuzzbucket-client create -c -S 20 -t m5.2xlarge " + alias + " -n " + box_name
remove_command = "fuzzbucket-client rm " + box_name
ssh_options = "-i fuzzbucket-ssh-key"

def get_api_key(username):
    # Calculate the MD5 hash for the username to get an API Key
    api_key = hashlib.md5(username.encode()).hexdigest()
    return api_key

def get_connect_version():
    if "CONNECT_VERSION" in os.environ:
        connect_version=os.environ['CONNECT_VERSION']
        return connect_version
    else:
        response = requests.get("https://cdn.posit.co/connect/latest-packages.json")
        connect_version = response.json()['packages'][0]['version']
        return connect_version

def get_current_connect_version(connect_ip, api_key):
    response = requests.get(
        'http://' + connect_ip + ':3939/__api__/server_settings',
        headers={'Authorization': 'Key ' + api_key},
        )
    current_connect = response.json()['version']
    return current_connect

def check_existing_boxes(box_name):
    output = subprocess.check_output(list_command, shell=True, text=True)
    # use the existing box if one exists
    if box_name+"\": {" in output:
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

# check if fuzzbucket is up and taking requests
def connect_ready(box_name, max_attempts, interval):
    connect_box=get_ip(box_name)

    attempts = 0
    while attempts < max_attempts:
        try:
            logging.info("Checking Connect Status")
            response = requests.get("http://"+connect_box+":3939/__ping__")
            if response.status_code == 200:
                if connect_version != get_current_connect_version(get_ip(box_name), api_key):
                    update_config="fuzzbucket-client ssh " + box_name + " " + ssh_options + " sudo sed -i 's/CONNECT_IP/" + connect_box + "/g' /etc/rstudio-connect/rstudio-connect.gcfg"
                    restart_connect = "fuzzbucket-client ssh " + box_name + " " + ssh_options + " sudo systemctl restart rstudio-connect"
                    logging.info("Installing Connect on " + connect_box)
                    subprocess.check_output(install_connect, shell=True, text=True)
                    subprocess.check_output(update_config, shell=True, text=True)
                    subprocess.check_output(restart_connect, shell=True, text=True)
                return response.text
        except requests.RequestException:
            pass

        time.sleep(interval)
        attempts += 1
    return None

api_key=get_api_key('admin')
connect_version=get_connect_version()
install_connect = "fuzzbucket-client ssh " + box_name + " " + ssh_options + " sudo -E UNATTENDED=1 bash installer-ci.sh -d " + connect_version

response = connect_ready(box_name, 20, 5)

if response:
    print("http://" + get_ip(box_name) + ":3939")
else:
    print("Server did not respond after multiple attempts.")
