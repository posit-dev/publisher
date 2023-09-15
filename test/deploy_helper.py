# import os

# class DirectoryEnumerator:
#     def __init__(self, directory_path):
#         self.directory_path = directory_path

#     # def list_files(self):
#     #     files = []
#     #     for root, _, filenames in os.walk(self.directory_path):
#     #         for filename in filenames:
#     #             file_path = os.path.join(root, filename)
#     #             files.append(file_path)
#     #         return files
        
#     def list_directories(self):
#         directories = []
#         for root, dirnames, _ in os.walk(self.directory_path):
#             for dirname in dirnames:
#                 dir_path = os.path.join(root,dirname)
#                 directories.append(dir_path)
#         return directories

# directory_path = "./sample-content"
# enumerator = DirectoryEnumerator(directory_path)

# # file_list = enumerator.list_files()
# # print("Files:")
# # for file_path in file_list:
# #     print(file_path)

# directory_list = enumerator.list_directories()
# print("Directories:")
# for dir_path in directory_list:
    # print(dir_path)

import os

# Specify the directory path
directory_path = "./sample-content/python/"

# Get a list of directories one layer deep
subdirectories = [d for d in os.listdir(directory_path) if os.path.isdir(os.path.join(directory_path, d))]


# print("deployments: " + subdirectories)

# for i in subdirectories:
#     deployment='sample-content/' + i
#     print("deployment: " + deployment)


    # for i in ${deployments}
    # do
    #   DEPLOYMENT=sample-content/$i
    #   echo "DEPLOYMENT: ${DEPLOYMENT}"
    #   source ./environments/.${TEST_SCENARIO}
    #   export CMD_ARGS="$CMD_ARGS"
    #   just ../web/build-and-test-ci-e2e {{target}}
    # done

# Print the list of directories
print(str(subdirectories).replace("[","").replace("]","").replace("'","").replace(",",""))