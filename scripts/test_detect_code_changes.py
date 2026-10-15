#!/usr/bin/env python3
"""Tests for detect-code-changes.py script."""

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "detect_code_changes",
    Path(__file__).parent / "detect-code-changes.py",
)
detect_code_changes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(detect_code_changes)


class TestIsDocFile(unittest.TestCase):
    def test_markdown_files(self):
        self.assertTrue(detect_code_changes.is_doc_file("README.md"))
        self.assertTrue(detect_code_changes.is_doc_file("CHANGELOG.md"))
        self.assertTrue(detect_code_changes.is_doc_file("docs/guide.md"))

    def test_special_doc_files(self):
        self.assertTrue(detect_code_changes.is_doc_file("LICENSE"))
        self.assertTrue(detect_code_changes.is_doc_file(".gitignore"))
        self.assertTrue(detect_code_changes.is_doc_file(".gitattributes"))

    def test_code_files(self):
        self.assertFalse(detect_code_changes.is_doc_file("src/index.ts"))
        self.assertFalse(detect_code_changes.is_doc_file("package.json"))
        self.assertFalse(detect_code_changes.is_doc_file(".github/workflows/ci.yaml"))


class TestIsReleaseBranch(unittest.TestCase):
    def test_release_branches(self):
        self.assertTrue(detect_code_changes.is_release_branch("release/v1.34.0"))
        self.assertTrue(detect_code_changes.is_release_branch("release/v2.0.0"))

    def test_non_release_branches(self):
        self.assertFalse(detect_code_changes.is_release_branch("main"))
        self.assertFalse(detect_code_changes.is_release_branch("feature/something"))
        self.assertFalse(detect_code_changes.is_release_branch("fix/release/v1"))


class TestIsVersionOnlyChange(unittest.TestCase):
    def test_version_only(self):
        diff = """\
--- a/package.json
+++ b/package.json
-  "version": "1.33.0",
+  "version": "1.34.0",
"""
        self.assertTrue(detect_code_changes.is_version_only_change(diff))

    def test_version_plus_other_changes(self):
        diff = """\
--- a/package.json
+++ b/package.json
-  "version": "1.33.0",
+  "version": "1.34.0",
+  "scripts": { "new-script": "echo hello" },
"""
        self.assertFalse(detect_code_changes.is_version_only_change(diff))

    def test_no_version_change(self):
        diff = """\
--- a/package.json
+++ b/package.json
-  "description": "old",
+  "description": "new",
"""
        self.assertFalse(detect_code_changes.is_version_only_change(diff))

    def test_empty_diff(self):
        self.assertTrue(detect_code_changes.is_version_only_change(""))


class TestIsDocsContent(unittest.TestCase):
    def test_docs_directory(self):
        self.assertTrue(detect_code_changes.is_docs_content("docs/index.md"))
        self.assertTrue(detect_code_changes.is_docs_content("docs/guide/install.md"))

    def test_docs_workflow(self):
        self.assertTrue(detect_code_changes.is_docs_content(".github/workflows/docs.yaml"))

    def test_non_docs(self):
        self.assertFalse(detect_code_changes.is_docs_content("src/index.ts"))
        self.assertFalse(detect_code_changes.is_docs_content(".github/workflows/ci.yaml"))


class TestClassifyChanges(unittest.TestCase):
    def test_only_docs(self):
        files = ["README.md", "CONTRIBUTING.md", "LICENSE"]
        has_code, has_docs = detect_code_changes.classify_changes(files, "main")
        self.assertFalse(has_code)
        self.assertFalse(has_docs)

    def test_docs_site_content(self):
        files = ["docs/guide.md", "README.md"]
        has_code, has_docs = detect_code_changes.classify_changes(files, "main")
        self.assertFalse(has_code)
        self.assertTrue(has_docs)

    def test_code_changes(self):
        files = ["src/index.ts", "README.md"]
        has_code, has_docs = detect_code_changes.classify_changes(files, "main")
        self.assertTrue(has_code)
        self.assertFalse(has_docs)

    def test_package_json_on_non_release_branch(self):
        files = ["package.json"]
        has_code, has_docs = detect_code_changes.classify_changes(files, "feature/foo")
        self.assertTrue(has_code)

    def test_package_json_version_only_on_release_branch(self):
        version_diff = """\
--- a/package.json
+++ b/package.json
-  "version": "1.33.0",
+  "version": "1.34.0",
"""
        files = ["package.json"]
        has_code, _ = detect_code_changes.classify_changes(
            files, "release/v1.34.0", get_diff_fn=lambda f: version_diff
        )
        self.assertFalse(has_code)

    def test_package_json_non_version_on_release_branch(self):
        diff = """\
--- a/package.json
+++ b/package.json
-  "version": "1.33.0",
+  "version": "1.34.0",
+  "dependencies": { "new-dep": "^1.0.0" },
"""
        files = ["package.json"]
        has_code, _ = detect_code_changes.classify_changes(
            files, "release/v1.34.0", get_diff_fn=lambda f: diff
        )
        self.assertTrue(has_code)

    def test_vscode_package_json_on_release_branch(self):
        version_diff = """\
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
-  "version": "1.33.0",
+  "version": "1.34.0",
"""
        files = ["extensions/vscode/package.json", "CHANGELOG.md"]
        has_code, _ = detect_code_changes.classify_changes(
            files, "release/v1.34.0", get_diff_fn=lambda f: version_diff
        )
        self.assertFalse(has_code)

    def test_lockfile_on_release_branch(self):
        files = ["package-lock.json", "CHANGELOG.md"]
        has_code, _ = detect_code_changes.classify_changes(files, "release/v1.34.0")
        self.assertFalse(has_code)

    def test_lockfile_on_non_release_branch(self):
        files = ["package-lock.json"]
        has_code, _ = detect_code_changes.classify_changes(files, "feature/foo")
        self.assertTrue(has_code)

    def test_full_release_pr(self):
        """Simulates a typical release PR with changelog + version bump."""
        version_diff = """\
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
-  "version": "2.6.0",
+  "version": "2.8.0",
"""
        files = [
            "CHANGELOG.md",
            "extensions/vscode/CHANGELOG.md",
            "extensions/vscode/package.json",
            "package-lock.json",
        ]
        has_code, has_docs = detect_code_changes.classify_changes(
            files, "release/v2.8.0", get_diff_fn=lambda f: version_diff
        )
        self.assertFalse(has_code)
        self.assertFalse(has_docs)

    def test_release_branch_without_diff_fn_treats_package_json_as_code(self):
        files = ["extensions/vscode/package.json"]
        has_code, _ = detect_code_changes.classify_changes(files, "release/v1.34.0")
        self.assertTrue(has_code)


if __name__ == "__main__":
    unittest.main()
