import hashlib
import shutil
import os
import sys
from os.path import dirname, join

server_txt = 'setup/servers.txt'
server_json = 'setup/servers.json'
shutil.copy(server_txt, server_json)

def copyfile(server_txt, server_json):
    # source_path = server_json  # Replace with the path of the source file
    destination_path = config_dirname()  # Replace with the destination directory path
    # desitination_file = os.path.join(destination_path, "servers.json")
    print(destination_path)
    # Copy the file to the destination
    shutil.move(server_json, destination_path)
    print("File copied successfully.")
    with open(destination_path+"/servers.json", "r") as file:
            contents = file.read()
            print(contents)

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
            os.makedirs(base_dir+"/.rsconnect-python/")
        except OSError:
            pass
        base_dir=base_dir+"/.rsconnect-python"
        return join(base_dir)
    else:
        os.makedirs(base_dir+"/rsconnect-python/")
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

    # Open the file for writing and overwrite with the modified content
    
 

def get_hash(username):

    # Calculate the MD5 hash for the username to get an API Key
    md5_hash = hashlib.md5(username.encode()).hexdigest()
    return md5_hash

replace_apikey('admin')
copyfile(server_txt, server_json)
print()
