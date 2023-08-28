import hashlib
import shutil
import os
import sys
from os.path import dirname, join

def copyfile(server_json):
    # source_path = server_json  # Replace with the path of the source file
    destination_path = config_dirname()  # Replace with the destination directory path
    # desitination_file = os.path.join(destination_path, "servers.json")
    print(destination_path)
    # Copy the file to the destination
    shutil.copy(server_json, destination_path)
    print("File copied successfully.")

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
        os.makedirs(base_dir+"/.rsconnect-python/")
        base_dir=base_dir+"/.rsconnect-python"
        return join(base_dir)
    else:
        os.makedirs(base_dir+"/rsconnect-python/")
        base_dir=base_dir+"/rsconnect-python"
        return join(base_dir)

def replace_apikey(username):
    with open(server_json, 'r') as file:
        server = file.read()
    api_key = server.replace('API_KEY', get_hash(username))

    # Open the file for writing and overwrite with the modified content
    with open(server_json, 'w') as file:
        file.write(api_key)

def get_hash(username):

    # Calculate the MD5 hash for the username to get an API Key
    md5_hash = hashlib.md5(username.encode()).hexdigest()
    print("MD5 hash:", md5_hash)
    return md5_hash

server_json = '../test/fixtures/servers.json'
copyfile(server_json)
replace_apikey('admin')
