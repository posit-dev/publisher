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

# Define patterns for forbidden licenses
# ---------------------------------------------------------------------
# How to use this list:
# - Add strings in lowercase as they will be matched against lowercase license text
# - Each string is a simple substring match (not regex)
# - If any pattern matches, the license is considered "forbidden"
# - All patterns below represent licenses incompatible with MIT
# ---------------------------------------------------------------------
forbidden_license_patterns = [
    # GPL Family (Strong Copyleft)
    "gpl-3.0", "gpl v3", "gnu general public license v3", "gplv3",
    "gpl-2.0", "gpl v2", "gnu general public license v2", "gplv2",
    "gpl-1.0", "gpl v1", "gnu general public license v1", "gplv1",
    "gpl", "gnu general public license",
    
    # AGPL Family (Network Copyleft)
    "agpl-3.0", "agpl v3", "gnu affero general public license", "agplv3",
    "agpl-1.0", "agplv1",
    "agpl", "affero gpl", "affero general",
    
    # LGPL (Lesser GPL variants)
    "lgpl-3.0", "lgpl v3", "gnu lesser general public license v3", "lgplv3",
    "lgpl-2.1", "lgpl v2.1", "gnu lesser general public license v2.1", "lgplv2.1",
    "lgpl-2.0", "lgpl v2", "gnu library general public license", "lgplv2",
    "lgpl", "lesser general public license", "library general public license",
    
    # Creative Commons Non-Commercial/No-Derivatives
    "cc-by-nc", "creative commons non-commercial",
    "cc-by-nd", "creative commons no derivatives",
    "cc-by-sa", "creative commons share alike",
    
    # Other Copyleft Licenses
    "mpl-1.1", "mozilla public license 1.1",  # MPL 1.1 (MPL 2.0 is MIT-compatible)
    "cddl", "common development and distribution license",
    "eclipse public license 1.0", "epl-1.0",  # EPL 1.0 (EPL 2.0 is MIT-compatible)
    "reciprocal public license",
    
    # Specific Restrictive Licenses
    "json license", # Requires "good, not evil" (problematic)
    "osl-3.0", "open software license 3.0",
    "cpol", "code project open license",
    "ijg license", # Independent JPEG Group License (possible patent issues)
    "eupl-1.2", "european union public license 1.2",
    
    # Commercial/Use Restrictions
    "non commercial use", "non-commercial use", "noncommercial", 
    "not for commercial use", "non-commercial purpose",
    "no commercial use",
    
    # Distribution Restrictions
    "no redistribution", "not be redistributed",
    "no distribution allowed", "distribution is prohibited",
    
    # Generic Copyleft Language
    "must be distributed under the same license",
    "must release your source code",
    "reciprocal license",
    "share-alike", "share alike",
    "copyleft",
    "viral license",
    
    # Potential Patent Issues
    "patent retaliation"
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

# Track forbidden licenses with their matching patterns
forbidden_licenses = {}
for name in sorted(licenses.keys()):
    output.append(f"### {name}")
    output.append("```")
    output.append(licenses[name])
    output.append("```")
    output.append("")
    
    # Check for forbidden licenses
    license_text = licenses[name].lower()
    matched_patterns = []
    
    for pattern in forbidden_license_patterns:
        if pattern in license_text:
            matched_patterns.append(pattern)
    
    if matched_patterns:
        forbidden_licenses[name] = matched_patterns

# Always generate the output content, even if there are errors
output_content = "\n".join(output)

# Check for forbidden licenses
if forbidden_licenses:
    print("\nERROR: MIT-incompatible licenses detected:", file=sys.stderr)
    for name, patterns in forbidden_licenses.items():
        print(f"  - {name}: matched patterns: {', '.join(patterns)}", file=sys.stderr)
    print("\nThese licenses are incompatible with the MIT license used by this project.", file=sys.stderr)
    print("Options to resolve this issue:", file=sys.stderr)
    print("1. Replace the dependencies with MIT-compatible alternatives", file=sys.stderr)
    print("2. If this is a false positive, update forbidden_license_patterns in scripts/licenses.py", file=sys.stderr)
    print("\nSee docs/license-compatibility.md for more information.", file=sys.stderr)
    
    # Still output the licenses to stdout, so the file isn't erased
    # This way, if we're redirecting to a file, the content will still be there
    print(output_content)
    
    # Then exit with error code
    sys.exit(1)

# Output the licenses
print(output_content)

