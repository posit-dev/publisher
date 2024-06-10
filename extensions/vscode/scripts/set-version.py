#!/usr/bin/env python3

import json
import re
import sys

if len(sys.argv) != 2:
    print("Usage: set-version.py <version>")
    sys.exit(1)

version = sys.argv[1]

version_re = re.compile(r"\d+\.\d+\.\d+")

if not version_re.match(version):
    print(f"Version {version} is not a release version; skipping version update.")
    sys.exit(0)

with open("package.json", "r") as f:
    data = json.load(f)

data["version"] = version

with open("package.json", "w") as f:
    json.dump(data, f, indent=2)
