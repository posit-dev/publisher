#!/usr/bin/env python3
"""
Prepares a release by updating CHANGELOG files.

Usage:
  ./scripts/prepare-release.py <version>     # Full release preparation
  ./scripts/prepare-release.py --sync-only   # Only sync VSCode changelog from root

Examples:
  ./scripts/prepare-release.py 1.34.0
  ./scripts/prepare-release.py --sync-only
"""

import re
import sys
from pathlib import Path

# ANSI colors for terminal output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# VSCode changelog header
VSCODE_CHANGELOG_HEADER = """# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

"""

# Versions before the VSCode extension was released (1.1.3 was initial beta)
PRE_EXTENSION_VERSIONS = {"1.1.2", "1.1.1", "1.1.0"}


def error(msg: str) -> None:
    """Print error message and exit."""
    print(f"{RED}Error:{NC} {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}Warning:{NC} {msg}", file=sys.stderr)


def info(msg: str) -> None:
    """Print info message with checkmark."""
    print(f"{GREEN}✓{NC} {msg}")


def parse_version(version: str) -> tuple[int, int, int]:
    """Parse and validate version string, returning (major, minor, patch)."""
    # Remove 'v' prefix if present
    version = version.lstrip("v")

    # Validate format
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", version)
    if not match:
        error(f"Invalid version format: {version} (expected x.y.z)")

    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def extract_unreleased_content(changelog_path: Path) -> str:
    """Extract content between [Unreleased] and next version header."""
    content = changelog_path.read_text()
    lines = content.split("\n")

    capturing = False
    unreleased_lines = []

    for line in lines:
        if re.match(r"^## \[Unreleased\]", line):
            capturing = True
            continue
        if capturing and re.match(r"^## \[", line):
            break
        if capturing:
            unreleased_lines.append(line)

    return "\n".join(unreleased_lines)


def update_root_changelog(changelog_path: Path, version: str) -> None:
    """Insert new version header after [Unreleased] in root changelog."""
    content = changelog_path.read_text()
    lines = content.split("\n")
    output_lines = []

    for line in lines:
        output_lines.append(line)
        if re.match(r"^## \[Unreleased\]", line):
            output_lines.append("")
            output_lines.append(f"## [{version}]")

    changelog_path.write_text("\n".join(output_lines))


def sync_vscode_changelog(root_changelog: Path, vscode_changelog: Path) -> None:
    """
    Sync VSCode CHANGELOG from root changelog.

    - Writes the VSCode extension-specific header
    - Strips the [Unreleased] section
    - Excludes pre-extension versions (before 1.1.3)
    - Excludes the root changelog header lines
    """
    content = root_changelog.read_text()
    lines = content.split("\n")

    release_lines = []

    skip_unreleased = False
    stop_processing = False

    # Lines to skip from root changelog header
    header_patterns = [
        r"^# Changelog",
        r"^All notable changes",
        r"^The format is based on",
        r"^and this project adheres",
    ]

    for line in lines:
        # Check for pre-extension versions - stop processing
        version_match = re.match(r"^## \[(\d+\.\d+\.\d+)\]", line)
        if version_match:
            version = version_match.group(1)
            # Check for pre-extension versions or 1.0.x versions
            if version in PRE_EXTENSION_VERSIONS or version.startswith("1.0."):
                stop_processing = True

        if stop_processing:
            break

        # Skip [Unreleased] section
        if re.match(r"^## \[Unreleased\]", line):
            skip_unreleased = True
            continue

        # Stop skipping when we hit a version header
        if skip_unreleased and re.match(r"^## \[", line):
            skip_unreleased = False

        if skip_unreleased:
            continue

        # Skip header lines from root
        if any(re.match(pattern, line) for pattern in header_patterns):
            continue

        release_lines.append(line)

    # Remove leading/trailing empty lines from release content
    while release_lines and release_lines[0] == "":
        release_lines.pop(0)
    while release_lines and release_lines[-1] == "":
        release_lines.pop()

    # Combine header with release content
    output = VSCODE_CHANGELOG_HEADER + "\n".join(release_lines) + "\n"

    vscode_changelog.write_text(output)


def main() -> None:
    # Handle --sync-only flag
    if len(sys.argv) == 2 and sys.argv[1] == "--sync-only":
        root_changelog = Path("CHANGELOG.md")
        vscode_changelog = Path("extensions/vscode/CHANGELOG.md")

        if not root_changelog.exists():
            error(f"Root CHANGELOG not found: {root_changelog}")

        print("info: syncing CHANGELOG.md from root to extensions/vscode...", file=sys.stderr)
        sync_vscode_changelog(root_changelog, vscode_changelog)
        print("info: CHANGELOG.md synced successfully", file=sys.stderr)
        return

    # Check arguments for release preparation
    if len(sys.argv) != 2:
        print("Usage: prepare-release.py <version>")
        print("       prepare-release.py --sync-only")
        print()
        print("Examples:")
        print("  prepare-release.py 1.34.0      # Full release preparation")
        print("  prepare-release.py --sync-only # Only sync VSCode changelog")
        sys.exit(1)

    version_arg = sys.argv[1]

    # Parse and validate version
    major, minor, patch = parse_version(version_arg)
    version = f"{major}.{minor}.{patch}"

    # Validate even minor version for production release
    if minor % 2 != 0:
        error(
            f"Production releases must have even minor version. "
            f"Got: {version} (minor={minor} is odd)"
        )

    info(f"Preparing release v{version}")

    # Paths
    root_changelog = Path("CHANGELOG.md")
    vscode_changelog = Path("extensions/vscode/CHANGELOG.md")

    # Check files exist
    if not root_changelog.exists():
        error(f"Root CHANGELOG not found: {root_changelog}")
    if not vscode_changelog.exists():
        error(f"VSCode CHANGELOG not found: {vscode_changelog}")

    # Extract unreleased content and check if empty
    unreleased_content = extract_unreleased_content(root_changelog)
    trimmed_content = unreleased_content.strip()

    if not trimmed_content:
        warn("No content found under [Unreleased] section")
        print()
        print("The [Unreleased] section appears to be empty.")
        print("Make sure changelog entries have been added before releasing.")
        print()
        response = input("Continue anyway? (y/N) ").strip().lower()
        if response != "y":
            sys.exit(1)

    # Update root CHANGELOG.md
    info(f"Updating {root_changelog}")
    update_root_changelog(root_changelog, version)

    # Sync VSCode CHANGELOG from root
    info(f"Syncing {vscode_changelog} from root")
    sync_vscode_changelog(root_changelog, vscode_changelog)

    info(f"Release v{version} prepared successfully!")
    print()
    print("Updated files:")
    print(f"  - {root_changelog}")
    print(f"  - {vscode_changelog}")
    print()
    print("Next steps:")
    print("  1. Review the changes: git diff")
    print(f"  2. Commit: git add -A && git commit -m 'Release v{version}'")
    print("  3. Create PR or push to main")
    print("  4. Tag will be created automatically when release PR merges")


if __name__ == "__main__":
    main()
