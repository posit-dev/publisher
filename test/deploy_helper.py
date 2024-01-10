import os

# Specify the directory path
directory_path = "../sample-content/python/"

# Get a list of directories
subdirectories = [d for d in os.listdir(directory_path) if os.path.isdir(os.path.join(directory_path, d))]

# Print the list of directories
print(str(subdirectories).replace("[","").replace("]","").replace("'","").replace(",",""))