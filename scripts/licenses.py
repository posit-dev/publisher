import os
import fnmatch
import sys

search_dirs = [
    "../vendor",
    "../extensions/vscode/node_modules",
    "../extensions/vscode/webviews/homeView/node_modules",
]

# Validate required directories exist
missing_dirs = []
for dir_path in search_dirs:
    if not os.path.exists(dir_path):
        missing_dirs.append(dir_path)

if missing_dirs:
    print(f"ERROR: Required directories are missing: {', '.join(missing_dirs)}", file=sys.stderr)
    print("Please ensure all dependencies are installed before generating licenses.", file=sys.stderr)
    print("Run 'just build' and 'just package' to populate these directories.", file=sys.stderr)
    sys.exit(1)

allowed_license_types = [
    "MIT",
    "Apache-2.0",
    "(MIT OR Apache-2.0)",
    "ISC",
    "(OFL-1.1 AND MIT)",
    "0BSD",
    "BSD-3-Clause",
    "BSD-2-Clause",
    # Used by jackspeak, path-scurry, package-json-from-dist
    # "Blue Oak Model License"
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

# Generate output
output = ["# Licenses\n"]

# Track non-allowed licenses
forbidden_licenses = {}
for name in sorted(licenses.keys()):
    output.append(f"### {name}")
    output.append("```")
    output.append(licenses[name])
    output.append("```")
    output.append("")
    
    # Check if the license is allowed
    license_text = licenses[name].lower()
    
    # Check against allowed license types
    matched_patterns = []
    for allowed_type in allowed_license_types:
        if allowed_type.lower() in license_text:
            matched_patterns.append(allowed_type)
    
    if not matched_patterns:
        forbidden_licenses[name] = ["not in allowed list"]

# Always generate the output content, even if there are errors
output_content = "\n".join(output)

# Check for forbidden licenses
if forbidden_licenses:
    print("\nERROR: Non-allowed licenses detected:", file=sys.stderr)
    print("\nOnly the following licenses are allowed:", file=sys.stderr)
    for license_type in sorted(allowed_license_types):
        print(f"  - {license_type}", file=sys.stderr)
    print("\nThe following packages have non-allowed licenses:", file=sys.stderr)
    for name in sorted(forbidden_licenses.keys()):
        print(f"  - {name}", file=sys.stderr)
    print("\nOptions to resolve this issue:", file=sys.stderr)
    print("1. Replace the dependencies with allowed-license alternatives", file=sys.stderr)
    print("2. If this is a false positive, update allowed_license_types in scripts/licenses.py", file=sys.stderr)
    print("\nSee docs/license-compatibility.md for more information.", file=sys.stderr)
    
    # Still output the licenses to stdout, so the file isn't erased
    # This way, if we're redirecting to a file, the content will still be there
    print(output_content)
    
    # Then exit with error code
    sys.exit(1)

# Output the licenses
print(output_content)
