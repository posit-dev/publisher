import sys
import hashlib

def get_api_key(username):
    md5_hash = hashlib.md5(username.encode()).hexdigest()
    print(md5_hash)
    return md5_hash

get_api_key(str(sys.argv[1]))