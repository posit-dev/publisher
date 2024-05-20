#!/usr/bin/env python

import os
import fnmatch

search_dirs = [
    "../vendor",
    "../extensions/vscode/node_modules",
    "../extensions/vscode/webviews/homeView/node_modules",
]

license_names = [
    "LICENSE*",
    "COPYING",
    "NOTICE",
]

licenses = {}

for base in search_dirs:
    for dirpath, dirnames, filenames in os.walk(base):
        for filename in filenames:
            if any(fnmatch.fnmatch(filename, license_name) for license_name in license_names):
                relPath = os.path.relpath(dirpath, base)
                name = relPath.removeprefix("./")
                licensePath = os.path.join(dirpath, filename)
                with open(licensePath, "r") as f:
                    licenses[name] = f.read()

print("# Licenses")

for name in sorted(licenses.keys()):
    print("###", name)
    print("```")
    print(licenses[name])
    print("```")
    print()

