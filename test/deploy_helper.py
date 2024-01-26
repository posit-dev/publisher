import os
import sys

# Get the current directory
script_dir = os.path.dirname(os.path.realpath(__file__))

# Specify the directory name
directory_name = sys.argv[1]

# Create the full path to the directory
directory_path = os.path.join(script_dir, directory_name)

# Check if the directory exists
if os.path.exists(directory_path) and os.path.isdir(directory_path):
    # Get a list of subdirectories
    subdirectories = [d for d in os.listdir(directory_path) if os.path.isdir(os.path.join(directory_path, d))]

    # Iterate over the subdirectories
    print(f"Subdirectories of the '{directory_name}' directory:")
    for subdirectory in subdirectories:
        print(subdirectory)
else:
    print(f"The '{directory_name}' directory does not exist in the same directory as the script.")