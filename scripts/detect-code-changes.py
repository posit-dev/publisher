#!/usr/bin/env python3
"""
Determines whether a PR contains code changes that require full CI,
or only documentation/release-metadata changes that can skip it.

Outputs (via GITHUB_OUTPUT file):
  has-code=true|false
  has-docs=true|false

Required environment variables:
  BASE_SHA  — the base commit to diff against
  BRANCH    — the PR head branch name
  GITHUB_OUTPUT — path to the GitHub Actions output file
"""

import os
import subprocess
import sys


DOC_FILES = {"LICENSE", ".gitignore", ".gitattributes"}
DOC_EXTENSIONS = {".md"}
PACKAGE_JSON_FILES = {"package.json", "extensions/vscode/package.json"}
LOCKFILE = "package-lock.json"
DOCS_PREFIXES = ("docs/", ".github/workflows/docs.yaml")


def get_changed_files(base_sha: str) -> list[str]:
    """Get the list of files changed between base_sha and HEAD."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{base_sha}...HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        result = subprocess.run(
            ["git", "diff", "--name-only", base_sha, "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
    return [f for f in result.stdout.strip().split("\n") if f]


def get_file_diff(base_sha: str, file_path: str) -> str:
    """Get the unified diff for a specific file."""
    result = subprocess.run(
        ["git", "diff", f"{base_sha}...HEAD", "--", file_path],
        capture_output=True,
        text=True,
    )
    return result.stdout


def is_version_only_change(diff_output: str) -> bool:
    """Check if a diff only modifies the 'version' field in a JSON file."""
    for line in diff_output.split("\n"):
        if not line.startswith(("+", "-")):
            continue
        # Skip diff header lines (+++, ---)
        if line.startswith(("+++", "---")):
            continue
        # Every added/removed line must contain "version"
        if '"version"' not in line:
            return False
    return True


def is_release_branch(branch: str) -> bool:
    """Check if the branch is a release branch."""
    return branch.startswith("release/v")


def is_doc_file(file_path: str) -> bool:
    """Check if a file is a documentation file."""
    if file_path in DOC_FILES:
        return True
    _, ext = os.path.splitext(file_path)
    return ext in DOC_EXTENSIONS


def is_docs_content(file_path: str) -> bool:
    """Check if a file is documentation site content."""
    return any(file_path.startswith(prefix) or file_path == prefix for prefix in DOCS_PREFIXES)


def classify_changes(
    changed_files: list[str],
    branch: str,
    get_diff_fn=None,
) -> tuple[bool, bool]:
    """Classify changed files into code vs docs/metadata.

    Returns (has_code, has_docs).
    """
    release = is_release_branch(branch)
    has_code = False
    has_docs = False

    for file_path in changed_files:
        if is_docs_content(file_path):
            has_docs = True

        if has_code:
            continue

        if is_doc_file(file_path):
            continue

        if file_path in PACKAGE_JSON_FILES:
            if release and get_diff_fn:
                diff = get_diff_fn(file_path)
                if is_version_only_change(diff):
                    continue
            has_code = True
            continue

        if file_path == LOCKFILE:
            if release:
                continue
            has_code = True
            continue

        has_code = True

    return has_code, has_docs


def main() -> None:
    base_sha = os.environ.get("BASE_SHA")
    branch = os.environ.get("BRANCH", "")
    output_file = os.environ.get("GITHUB_OUTPUT")

    if not base_sha:
        print("::error::BASE_SHA must be set", file=sys.stderr)
        sys.exit(1)

    if not output_file:
        print("::error::GITHUB_OUTPUT must be set", file=sys.stderr)
        sys.exit(1)

    changed_files = get_changed_files(base_sha)

    if not changed_files:
        print("No files changed")
        with open(output_file, "a") as f:
            f.write("has-code=false\n")
            f.write("has-docs=false\n")
        return

    print("Changed files:")
    for file_path in changed_files:
        print(f"  {file_path}")
    print()

    def get_diff_fn(file_path: str) -> str:
        return get_file_diff(base_sha, file_path)

    has_code, has_docs = classify_changes(changed_files, branch, get_diff_fn)

    if has_code:
        print("Code files changed — full CI required")
    else:
        print("Only documentation/release-metadata files changed — skipping full CI")

    with open(output_file, "a") as f:
        f.write(f"has-code={'true' if has_code else 'false'}\n")
        f.write(f"has-docs={'true' if has_docs else 'false'}\n")


if __name__ == "__main__":
    main()
