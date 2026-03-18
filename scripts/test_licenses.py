#!/usr/bin/env python3
"""Tests for licenses.py script.

These tests verify that the license checking script correctly identifies
forbidden licenses and handles missing directories.

Run with: python3 scripts/test_licenses.py
Or with pytest: pytest scripts/test_licenses.py -v
"""

import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent / "licenses.py"


def create_test_structure(base_path: Path, packages: dict[str, dict[str, str]]) -> None:
    """Create a mock directory structure with license files.

    Args:
        base_path: Root directory for the test structure
        packages: Dict mapping package paths to {filename: content} dicts
                  e.g., {"vendor/foo": {"LICENSE": "MIT License..."}}
    """
    for package_path, files in packages.items():
        pkg_dir = base_path / package_path
        pkg_dir.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            (pkg_dir / filename).write_text(content)


def run_licenses_script(base_path: Path) -> subprocess.CompletedProcess:
    """Run the licenses.py script with LICENSES_REPO_ROOT pointing to base_path."""
    return subprocess.run(
        ["python3", str(SCRIPT_PATH)],
        env={"LICENSES_REPO_ROOT": str(base_path)},
        capture_output=True,
        text=True,
    )


class TestForbiddenLicenses(unittest.TestCase):
    """Tests for forbidden license detection."""

    def test_allowed_licenses_pass(self):
        """Packages with allowed licenses should not cause failures."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            create_test_structure(
                base,
                {
                    "vendor/mit-pkg": {"LICENSE": "MIT License\nCopyright..."},
                    "vendor/apache-pkg": {
                        "LICENSE": "Apache-2.0\nLicensed under Apache..."
                    },
                    "vendor/isc-pkg": {"LICENSE": "ISC License\nCopyright..."},
                    "extensions/vscode/node_modules/bsd-pkg": {
                        "LICENSE": "BSD-3-Clause\nRedistribution..."
                    },
                    "extensions/vscode/webviews/homeView/node_modules/placeholder": {
                        "LICENSE": "MIT License"
                    },
                },
            )

            result = run_licenses_script(base)
            self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")

    def test_forbidden_license_fails(self):
        """Packages with non-allowed licenses should cause failure."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            create_test_structure(
                base,
                {
                    "vendor/gpl-pkg": {
                        "LICENSE": "GNU General Public License v3.0"
                    },
                    "extensions/vscode/node_modules/placeholder": {
                        "LICENSE": "MIT License"
                    },
                    "extensions/vscode/webviews/homeView/node_modules/placeholder": {
                        "LICENSE": "MIT License"
                    },
                },
            )

            result = run_licenses_script(base)
            self.assertEqual(result.returncode, 1)
            self.assertIn("Non-allowed licenses detected", result.stderr)
            self.assertIn("gpl-pkg", result.stderr)


class TestMissingDirectories(unittest.TestCase):
    """Tests for missing directory handling."""

    def test_missing_vendor_fails(self):
        """Missing vendor directory should cause failure."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            # Only create node_modules, not vendor
            create_test_structure(
                base,
                {
                    "extensions/vscode/node_modules/pkg": {"LICENSE": "MIT"},
                    "extensions/vscode/webviews/homeView/node_modules/pkg": {
                        "LICENSE": "MIT"
                    },
                },
            )

            result = run_licenses_script(base)
            self.assertEqual(result.returncode, 1)
            self.assertIn("Required directories are missing", result.stderr)
            self.assertIn("vendor", result.stderr)

    def test_missing_node_modules_fails(self):
        """Missing node_modules directory should cause failure."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            # Only create vendor, not node_modules
            create_test_structure(
                base,
                {
                    "vendor/pkg": {"LICENSE": "MIT"},
                },
            )

            result = run_licenses_script(base)
            self.assertEqual(result.returncode, 1)
            self.assertIn("Required directories are missing", result.stderr)


class TestLicenseFilePatterns(unittest.TestCase):
    """Tests for different license file name patterns."""

    def test_license_file_patterns(self):
        """Various license file patterns should be recognized."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            create_test_structure(
                base,
                {
                    "vendor/pkg1": {"LICENSE": "MIT License"},
                    "vendor/pkg2": {"LICENSE.txt": "MIT License"},
                    "vendor/pkg3": {"LICENSE.md": "MIT License"},
                    "vendor/pkg4": {"COPYING": "MIT License"},
                    "vendor/pkg5": {"NOTICE": "MIT License"},
                    "extensions/vscode/node_modules/placeholder": {
                        "LICENSE": "MIT License"
                    },
                    "extensions/vscode/webviews/homeView/node_modules/placeholder": {
                        "LICENSE": "MIT License"
                    },
                },
            )

            result = run_licenses_script(base)
            self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")


if __name__ == "__main__":
    unittest.main()
