import subprocess
import json

list_command = "fuzzbucket-client -j list"
box_name = "connect-publishing-client"

output = subprocess.check_output(list_command, shell=True, text=True)
boxes = json.loads(output)
connect_ip = boxes["boxes"][box_name]["public_ip"]
print("http://"+connect_ip+":3939")