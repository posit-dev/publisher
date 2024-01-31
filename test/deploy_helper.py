import os
import sys

# Get the current directory
script_dir = os.path.dirname(os.path.realpath(__file__))

# Specify the directory name
directory_name = os.path.join( "content", "bundles" )

# Create the full path to the directory
directory_path = os.path.join(script_dir, directory_name)

# Check if the directory exists
if os.path.exists(directory_path) and os.path.isdir(directory_path):
    # Get a list of subdirectories
    subdirectories = [d for d in os.listdir(directory_path) if os.path.isdir(os.path.join(directory_path, d))]

    # Iterate over the subdirectories
    content_list = []
    for subdirectory in subdirectories:
        content_list.append(subdirectory)
    content_string = " ".join(content_list)
    print(content_string)
else:
    print(f"The '{directory_name}' directory does not exist in the same directory as the script.")