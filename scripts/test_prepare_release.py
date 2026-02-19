#!/usr/bin/env python3
"""Tests for prepare-release.py script.

Run with: python3 scripts/test_prepare_release.py
"""

import subprocess
import tempfile
import unittest
from pathlib import Path

# Import functions from the script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

# Import the module (handle the hyphen in filename)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "prepare_release",
    Path(__file__).parent / "prepare-release.py"
)
prepare_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare_release)

SAMPLE_ROOT_CHANGELOG = """\
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New feature A
- New feature B

### Fixed

- Bug fix C

## [1.32.0]

### Changed

- Changed something

## [1.30.0]

### Added

- Old feature

## [1.1.2]

### Added

- Pre-extension feature
"""

SAMPLE_VSCODE_CHANGELOG = """\
# Changelog

All notable changes to the Posit Publisher extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.32.0]

### Changed

- Changed something

## [1.30.0]

### Added

- Old feature
"""


class TestParseVersion(unittest.TestCase):
    """Tests for version parsing and validation."""

    def test_valid_version(self):
        """Valid version string should parse correctly."""
        major, minor, patch = prepare_release.parse_version("1.34.0")
        self.assertEqual((major, minor, patch), (1, 34, 0))

    def test_version_with_v_prefix(self):
        """Version with 'v' prefix should be handled."""
        major, minor, patch = prepare_release.parse_version("v1.34.0")
        self.assertEqual((major, minor, patch), (1, 34, 0))

    def test_invalid_version_format(self):
        """Invalid version format should exit with error."""
        with self.assertRaises(SystemExit):
            prepare_release.parse_version("invalid")

    def test_incomplete_version(self):
        """Incomplete version should exit with error."""
        with self.assertRaises(SystemExit):
            prepare_release.parse_version("1.34")

    def test_version_with_extra_parts(self):
        """Version with extra parts should exit with error."""
        with self.assertRaises(SystemExit):
            prepare_release.parse_version("1.34.0.1")


class TestExtractUnreleasedContent(unittest.TestCase):
    """Tests for extracting unreleased content from changelog."""

    def test_extract_unreleased_content(self):
        """Should extract content between [Unreleased] and next version."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write(SAMPLE_ROOT_CHANGELOG)
            f.flush()
            changelog_path = Path(f.name)

        try:
            content = prepare_release.extract_unreleased_content(changelog_path)
            self.assertIn("New feature A", content)
            self.assertIn("New feature B", content)
            self.assertIn("Bug fix C", content)
            self.assertNotIn("[1.32.0]", content)
        finally:
            changelog_path.unlink()

    def test_empty_unreleased_section(self):
        """Empty unreleased section should return empty/whitespace content."""
        changelog = """\
# Changelog

## [Unreleased]

## [1.0.0]

### Added

- Something
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write(changelog)
            f.flush()
            changelog_path = Path(f.name)

        try:
            content = prepare_release.extract_unreleased_content(changelog_path)
            self.assertEqual(content.strip(), "")
        finally:
            changelog_path.unlink()


class TestUpdateRootChangelog(unittest.TestCase):
    """Tests for updating root changelog with new version."""

    def test_insert_version_header(self):
        """Should insert new version header after [Unreleased]."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write(SAMPLE_ROOT_CHANGELOG)
            f.flush()
            changelog_path = Path(f.name)

        try:
            prepare_release.update_root_changelog(changelog_path, "1.34.0")
            content = changelog_path.read_text()

            # Should have both [Unreleased] and [1.34.0]
            self.assertIn("## [Unreleased]", content)
            self.assertIn("## [1.34.0]", content)

            # [1.34.0] should come after [Unreleased]
            unreleased_pos = content.find("## [Unreleased]")
            new_version_pos = content.find("## [1.34.0]")
            self.assertLess(unreleased_pos, new_version_pos)

            # [1.34.0] should come before [1.32.0]
            old_version_pos = content.find("## [1.32.0]")
            self.assertLess(new_version_pos, old_version_pos)
        finally:
            changelog_path.unlink()


class TestSyncVscodeChangelog(unittest.TestCase):
    """Tests for syncing VSCode changelog from root."""

    def test_sync_excludes_unreleased(self):
        """Synced changelog should not contain [Unreleased] section."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_changelog = Path(tmpdir) / "VSCODE_CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)

            prepare_release.sync_vscode_changelog(root_changelog, vscode_changelog)

            content = vscode_changelog.read_text()
            self.assertNotIn("[Unreleased]", content)
            self.assertNotIn("New feature A", content)

    def test_sync_includes_released_versions(self):
        """Synced changelog should include released versions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_changelog = Path(tmpdir) / "VSCODE_CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)

            prepare_release.sync_vscode_changelog(root_changelog, vscode_changelog)

            content = vscode_changelog.read_text()
            self.assertIn("## [1.32.0]", content)
            self.assertIn("## [1.30.0]", content)
            self.assertIn("Changed something", content)

    def test_sync_excludes_pre_extension_versions(self):
        """Synced changelog should exclude pre-extension versions (before 1.1.3)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_changelog = Path(tmpdir) / "VSCODE_CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)

            prepare_release.sync_vscode_changelog(root_changelog, vscode_changelog)

            content = vscode_changelog.read_text()
            self.assertNotIn("[1.1.2]", content)
            self.assertNotIn("Pre-extension feature", content)

    def test_sync_has_vscode_header(self):
        """Synced changelog should have VSCode-specific header."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_changelog = Path(tmpdir) / "VSCODE_CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)

            prepare_release.sync_vscode_changelog(root_changelog, vscode_changelog)

            content = vscode_changelog.read_text()
            self.assertIn("# Changelog", content)
            self.assertIn("Posit Publisher extension", content)
            self.assertIn("Keep a Changelog", content)

    def test_sync_excludes_root_header(self):
        """Synced changelog should not duplicate root changelog header text."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_changelog = Path(tmpdir) / "VSCODE_CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)

            prepare_release.sync_vscode_changelog(root_changelog, vscode_changelog)

            content = vscode_changelog.read_text()
            # Should only have one "# Changelog" (from VSCode header)
            self.assertEqual(content.count("# Changelog"), 1)


class TestSyncOnlyMode(unittest.TestCase):
    """Tests for --sync-only command line mode."""

    def test_sync_only_flag(self):
        """--sync-only should only sync VSCode changelog without version."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create directory structure
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_dir = Path(tmpdir) / "extensions" / "vscode"
            vscode_dir.mkdir(parents=True)
            vscode_changelog = vscode_dir / "CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)
            vscode_changelog.write_text("")  # Empty file

            # Run the script with --sync-only
            result = subprocess.run(
                ["python3", str(Path(__file__).parent / "prepare-release.py"), "--sync-only"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0)
            self.assertIn("synced successfully", result.stderr)

            # Check VSCode changelog was created correctly
            content = vscode_changelog.read_text()
            self.assertIn("## [1.32.0]", content)
            self.assertNotIn("[Unreleased]", content)


class TestFullReleasePreparation(unittest.TestCase):
    """Tests for full release preparation flow."""

    def test_odd_minor_version_rejected(self):
        """Odd minor version should be rejected for production release."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_dir = Path(tmpdir) / "extensions" / "vscode"
            vscode_dir.mkdir(parents=True)
            vscode_changelog = vscode_dir / "CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)
            vscode_changelog.write_text(SAMPLE_VSCODE_CHANGELOG)

            result = subprocess.run(
                ["python3", str(Path(__file__).parent / "prepare-release.py"), "1.33.0"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("even minor version", result.stderr)

    def test_full_release_preparation(self):
        """Full release should update both changelogs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root_changelog = Path(tmpdir) / "CHANGELOG.md"
            vscode_dir = Path(tmpdir) / "extensions" / "vscode"
            vscode_dir.mkdir(parents=True)
            vscode_changelog = vscode_dir / "CHANGELOG.md"

            root_changelog.write_text(SAMPLE_ROOT_CHANGELOG)
            vscode_changelog.write_text(SAMPLE_VSCODE_CHANGELOG)

            # Provide 'y' to empty changelog prompt (won't be needed since we have content)
            result = subprocess.run(
                ["python3", str(Path(__file__).parent / "prepare-release.py"), "1.34.0"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                input="y\n",
            )

            self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")

            # Check root changelog has new version
            root_content = root_changelog.read_text()
            self.assertIn("## [1.34.0]", root_content)
            self.assertIn("## [Unreleased]", root_content)

            # Check VSCode changelog has new version
            vscode_content = vscode_changelog.read_text()
            self.assertIn("## [1.34.0]", vscode_content)
            self.assertNotIn("[Unreleased]", vscode_content)


if __name__ == "__main__":
    unittest.main()
