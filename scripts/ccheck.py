#!/usr/bin/env python3

import argparse
import glob
import pathlib
import re
import sys
import io

from datetime import datetime
from os.path import basename

# Go and JS
header1 = r"""// Copyright \(C\) \d{4} by Posit Software, PBC."""

# Python, R and shell scripts
header2 = r"""# Copyright \(C\) \d{4} by Posit Software, PBC."""

# Vue files
header3 = r"""<!-- Copyright \(C\) \d{4} by Posit Software, PBC. -->"""

# header must occur within the first max_read bytes
max_read = 4000
headers = {
    "go": header1,
    "js": header1,
    "R": header2,
    "py": header2,
    "sh": header2,
    "vue": header3,
}


def get_target_header(file_name):
    path = pathlib.PurePath(file_name)
    suffix = path.suffix
    # Since some of our scripts don't have an extension...
    if suffix == "" and path.parent.name == "scripts":
        suffix = "sh"
    else:
        suffix = suffix[1:]
    header = headers.get(suffix)

    if header:
        return header

    raise ValueError('".%s" files are not supported' % suffix)


def parse_arguments():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--fix",
        help="Fix missing headers by modifying the offending files",
        action="store_const",
        const=True,
        default=False,
    )
    parser.add_argument(
        "config",
        metavar="FILE",
        type=str,
        help="Path to configuration file containing a list of git-style file "
             "patterns. * and ** are wildcards; prefix pattern with a - sign to "
             "exclude files matching the pattern.",
    )

    args = parser.parse_args()

    with open(args.config, "r") as f:
        lines = map(str.strip, f.readlines())
        pattern_list = list(filter(lambda s: s and not s.startswith("#"), lines))

    return pattern_list, args.fix


def copyright_status(file_name):
    """Determine whether the specified file contains a copyright header.

    Returns one of 3 values:
    * True if the file contains a proper copyright statement
    * False if it contains 'Copyright' but not the expected statement.
    * None if there is nothing resembling a copyright statement.
    """
    with io.open(file_name, "r", encoding="utf-8") as f:
        contents = f.read(max_read)

    if not contents:
        # don't comment empty files
        return True

    header = get_target_header(file_name)

    m = re.search(header, contents, re.MULTILINE)
    if m:
        return True

    if "Copyright" in contents:
        return False

    return None


def inject_comment_block(file_name):
    """Inject a proper copyright statement into the specified file.

    The filename and year will be inserted at the proper location.
    The copyright header will be injected into the file at the top,
    after the shebang (#!) line, if any.
    """
    with io.open(file_name, "r", encoding="utf-8") as f:
        contents = f.read()

    header = get_target_header(file_name)
    filled_header = (
        header.replace(r"(?P<filename>.*)", basename(file_name))
            .replace(r"\d{4}", str(datetime.now().year))
            .replace("\\.", ".")
            .replace("\\", "")
    )

    if contents.startswith("#!"):
        pre_content, post_content = contents.split("\n", 1)
        pre_content += "\n\n"
    else:
        pre_content = ""
        post_content = contents

    new_contents = "".join([pre_content, filled_header, "\n\n", post_content])

    with io.open(file_name, "w", encoding="utf-8") as f:
        f.write(new_contents)


patterns, fix = parse_arguments()
include_patterns = [p for p in patterns if not p.startswith("-")]
exclude_patterns = [p for p in patterns if p.startswith("-")]

excluded_fileset = set()
for pattern in exclude_patterns:
    excluded_fileset |= set(glob.iglob(pattern[1:], recursive=True))

errs = 0
ok = 0
checked = 0
fixed = 0
recheck = 0

for pattern in include_patterns:
    print("\n%s" % pattern)

    for filename in glob.glob(pattern, recursive=True):
        if filename in excluded_fileset:
            continue

        checked += 1
        status = copyright_status(filename)

        if status:
            ok += 1
        else:
            errs += 1

            print("missing copyright header in %s" % filename, end="")

            if fix:
                inject_comment_block(filename)
                fixed += 1

                if status is None:
                    # no copyright
                    print(" [fixed]")
                else:
                    # there was 'Copyright' but not a full match
                    print(" [fixed, check original]")
                    recheck += 1
            else:
                print()

print()
print("Checked %d files; excluded %d" % (checked, len(excluded_fileset)))
print("%d ok; %d missing headers" % (ok, errs))

if fix:
    print(
        "%d fixed; %d need to be checked for pre-existing copyright statements"
        % (fixed, recheck)
    )

if errs:
    sys.exit(2)
