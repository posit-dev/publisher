import hashlib
import shutil
import os
import sys
from datetime import datetime
from os.path import join

server_txt = 'setup/servers.txt'
server_json = 'setup/servers.json'
shutil.copy(server_txt, server_json)

def copyfile(server_txt, server_json):
    destination_path = config_dirname()
    print(destination_path)

    server_file = destination_path+"/"+"servers.json"

    if not os.path.exists(server_file):
        shutil.move(server_json, server_file)
        print("File copied successfully to " + destination_path)
    else:
        # with open(server_file, 'w'): pass
        shutil.move(server_file, server_file+"_"+datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        shutil.move(server_json, destination_path)
        print("File copied successfully to " + destination_path)

def config_dirname(platform=sys.platform, env=os.environ):
    """Get the user's configuration directory path for this platform."""
    home = env.get("HOME", "~")
    base_dir = home

    if platform.startswith("linux"):
        base_dir = env.get("XDG_CONFIG_HOME", home)
    elif platform == "darwin":
        base_dir = join(home, "Library", "Application Support")
    elif platform == "win32":
        # noinspection SpellCheckingInspection
        base_dir = env.get("APPDATA", home)

    if base_dir == home:
        try:
            if not os.path.exists(base_dir+"/.rsconnect-python/"):
                os.makedirs(base_dir+"/.rsconnect-python/")
        except OSError:
            pass
        base_dir=base_dir+"/.rsconnect-python"
        return join(base_dir)
    else:
        try:
            if not os.path.exists(base_dir+"/rsconnect-python/"):
                os.makedirs(base_dir+"/rsconnect-python/")
        except OSError:
            pass
        base_dir=base_dir+"/rsconnect-python"
        return join(base_dir)

def replace_apikey(username):
    # replace api key
    with open(server_json, 'r') as file:
        server = file.read()
    api_key = server.replace('API_KEY', get_hash(username))
    with open(server_json, 'w') as file:
        file.write(api_key)
        file.close()
    # replace connect url
    with open(server_json, 'r') as file:
        server = file.read()
    connect_ip = server.replace('CONNECT_IP', os.environ['CONNECT_IP'])
    with open(server_json, 'w') as file:
        file.write(connect_ip)
        file.close()  

def get_hash(username):

    # Calculate the MD5 hash for the username to get an API Key
    md5_hash = hashlib.md5(username.encode()).hexdigest()
    return md5_hash

replace_apikey('admin')
copyfile(server_txt, server_json)