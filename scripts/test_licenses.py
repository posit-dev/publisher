#!/usr/bin/env python3
"""Tests for licenses.py script.

These tests verify that the license generation script produces deterministic
output and correctly identifies forbidden licenses.

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
    """Run the licenses.py script from a docs/ subdirectory.

    The script expects to be run from a docs/ directory and looks for
    ../vendor, ../extensions/vscode/node_modules, etc.
    """
    docs_dir = base_path / "docs"
    docs_dir.mkdir(exist_ok=True)

    return subprocess.run(
        ["python3", str(SCRIPT_PATH)],
        cwd=docs_dir,
        capture_output=True,
        text=True,
    )


class TestDeterministicOutput(unittest.TestCase):
    """Tests verifying that output is deterministic."""

    def test_multiple_license_files_same_package(self):
        """When a package has multiple license files, output should be deterministic.

        Files are processed in sorted order, so the last alphabetically wins.
        """
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            # Create package with multiple license files
            create_test_structure(
                base,
                {
                    "vendor/test-pkg": {
                        "LICENSE": "MIT License - File A",
                        "LICENSE.md": "MIT License - File B",
                    },
                    "extensions/vscode/node_modules/other-pkg": {
                        "LICENSE": "MIT License",
                    },
                    "extensions/vscode/webviews/homeView/node_modules/placeholder": {
                        "LICENSE": "MIT License",
                    },
                },
            )

            # Run multiple times and verify output is identical
            results = [run_licenses_script(base) for _ in range(3)]

            for r in results:
                self.assertEqual(r.returncode, 0, f"Script failed: {r.stderr}")

            self.assertEqual(results[0].stdout, results[1].stdout)
            self.assertEqual(results[1].stdout, results[2].stdout)

            # Verify the last alphabetically (LICENSE.md) wins
            self.assertIn("File B", results[0].stdout)
            self.assertNotIn("File A", results[0].stdout)

    def test_packages_sorted_alphabetically(self):
        """Output should list packages in alphabetical order."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)

            create_test_structure(
                base,
                {
                    "vendor/zebra": {"LICENSE": "MIT License"},
                    "vendor/alpha": {"LICENSE": "MIT License"},
                    "vendor/middle": {"LICENSE": "MIT License"},
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

            # Find positions of each package in output
            alpha_pos = result.stdout.find("### alpha")
            middle_pos = result.stdout.find("### middle")
            zebra_pos = result.stdout.find("### zebra")

            self.assertLess(alpha_pos, middle_pos)
            self.assertLess(middle_pos, zebra_pos)


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

    def test_forbidden_license_still_outputs_content(self):
        """Even when forbidden licenses are found, content should be output."""
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
            # Content should still be in stdout even though we failed
            self.assertIn("# Licenses", result.stdout)
            self.assertIn("### gpl-pkg", result.stdout)


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

            # All packages should be in output
            for i in range(1, 6):
                self.assertIn(f"### pkg{i}", result.stdout)


if __name__ == "__main__":
    unittest.main()
