#!/usr/bin/env python3
"""
Tests for the GitHub Actions Security Audit Script.

Run with: python scripts/test_audit_gha_security.py
Or: cd scripts && python -m unittest test_audit_gha_security -v
"""

import io
import sys
import tempfile
import unittest
from pathlib import Path

from audit_gha_security import (
    AuditResult,
    Output,
    Finding,
    check_explicit_permissions,
    check_secrets_inherit,
    check_fork_pr_protection,
    check_tag_ancestry_verification,
    check_workflow_dispatch_protection,
    check_overly_permissive,
    check_unpinned_actions,
    check_dangerous_patterns,
    get_workflow_files,
)


def create_workflow(directory: Path, name: str, content: str) -> Path:
    """Helper to create a workflow file."""
    filepath = directory / name
    filepath.write_text(content)
    return filepath


def create_silent_output() -> Output:
    """Create an Output instance that doesn't print to stdout."""
    return Output(github_actions=False, use_colors=False)


class TestGetWorkflowFiles(unittest.TestCase):
    def test_finds_yaml_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_dir = Path(tmpdir)
            create_workflow(temp_dir, "test.yaml", "name: Test")
            create_workflow(temp_dir, "test2.yml", "name: Test2")

            files = get_workflow_files(temp_dir)

            self.assertEqual(len(files), 2)
            self.assertTrue(any(f.name == "test.yaml" for f in files))
            self.assertTrue(any(f.name == "test2.yml" for f in files))

    def test_ignores_non_yaml_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_dir = Path(tmpdir)
            create_workflow(temp_dir, "test.yaml", "name: Test")
            create_workflow(temp_dir, "readme.md", "# Readme")

            files = get_workflow_files(temp_dir)

            self.assertEqual(len(files), 1)
            self.assertEqual(files[0].name, "test.yaml")


class TestFinding(unittest.TestCase):
    def test_finding_creation(self):
        finding = Finding(
            level="error",
            check="test-check",
            file="test.yaml",
            message="Test message",
            line=10,
            suggestion="Fix it",
        )
        self.assertEqual(finding.level, "error")
        self.assertEqual(finding.check, "test-check")
        self.assertEqual(finding.file, "test.yaml")
        self.assertEqual(finding.message, "Test message")
        self.assertEqual(finding.line, 10)
        self.assertEqual(finding.suggestion, "Fix it")


class TestAuditResult(unittest.TestCase):
    def test_empty_result(self):
        result = AuditResult()
        self.assertEqual(result.error_count, 0)
        self.assertEqual(result.warning_count, 0)
        self.assertFalse(result.has_errors)
        self.assertFalse(result.has_warnings)

    def test_with_errors(self):
        result = AuditResult()
        result.errors.append(
            Finding(level="error", check="test", file="test.yaml", message="error")
        )
        self.assertEqual(result.error_count, 1)
        self.assertTrue(result.has_errors)

    def test_with_warnings(self):
        result = AuditResult()
        result.warnings.append(
            Finding(level="warning", check="test", file="test.yaml", message="warning")
        )
        self.assertEqual(result.warning_count, 1)
        self.assertTrue(result.has_warnings)


class TestExplicitPermissions(unittest.TestCase):
    def test_passes_with_permissions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "good.yaml",
                """name: Good
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_explicit_permissions([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 0)
            self.assertIn("Has explicit permissions", output)

    def test_fails_without_permissions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
jobs:
  test:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_explicit_permissions([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)
            self.assertIn("permissions", result.errors[0].message)


class TestSecretsInherit(unittest.TestCase):
    def test_passes_without_inherit(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "good.yaml",
                """name: Good
jobs:
  call-workflow:
    uses: ./.github/workflows/other.yaml
    secrets:
      API_KEY: ${{ secrets.API_KEY }}
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_secrets_inherit([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 0)
            self.assertIn("No workflows use 'secrets: inherit'", output)

    def test_fails_with_inherit(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
jobs:
  call-workflow:
    uses: ./.github/workflows/other.yaml
    secrets: inherit
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_secrets_inherit([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)
            self.assertIn("secrets: inherit", result.errors[0].message)


class TestForkPRProtection(unittest.TestCase):
    def test_passes_with_fork_check(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "good.yaml",
                """name: Good
on:
  pull_request:
jobs:
  test:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - run: echo ${{ secrets.API_KEY }}
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_fork_pr_protection([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)

    def test_warns_without_fork_check(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
on:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo ${{ secrets.API_KEY }}
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_fork_pr_protection([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("fork PR protection", result.warnings[0].message)

    def test_ignores_workflow_without_secrets(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "nosecrets.yaml",
                """name: No Secrets
on:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "hello"
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_fork_pr_protection([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)


class TestTagAncestryVerification(unittest.TestCase):
    def test_passes_with_verification(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "release.yaml",
                """name: Release
on:
  push:
    tags:
      - "v*.*.*"
jobs:
  verify:
    steps:
      - run: git merge-base --is-ancestor ${{ github.sha }} origin/main
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_tag_ancestry_verification([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)
            self.assertIn("has ancestry verification", output)

    def test_passes_with_composite_action(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "release.yaml",
                """name: Release
on:
  push:
    tags:
      - "v*.*.*"
jobs:
  verify:
    steps:
      - uses: ./.github/actions/verify-tag-ancestry
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_tag_ancestry_verification([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)

    def test_warns_without_verification(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "release.yaml",
                """name: Release
on:
  push:
    tags:
      - "v*.*.*"
jobs:
  build:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_tag_ancestry_verification([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("ancestry verification", result.warnings[0].message)

    def test_ignores_non_tag_workflows(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "ci.yaml",
                """name: CI
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_tag_ancestry_verification([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)


class TestWorkflowDispatchProtection(unittest.TestCase):
    def test_passes_without_dispatch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "release.yaml",
                """name: Release
on:
  push:
    tags:
      - "v*"
jobs:
  build:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_workflow_dispatch_protection([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)
            self.assertIn("No workflow_dispatch", output)

    def test_passes_with_environment_protection(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "publish.yaml",
                """name: Publish
on:
  workflow_dispatch:
jobs:
  deploy:
    environment: production
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_workflow_dispatch_protection([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)
            self.assertIn("with protection", output)

    def test_warns_without_protection(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "publish.yaml",
                """name: Publish
on:
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_workflow_dispatch_protection([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("without visible protection", result.warnings[0].message)

    def test_ignores_non_sensitive_workflows(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "ci.yaml",
                """name: CI
on:
  workflow_dispatch:
jobs:
  test:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_workflow_dispatch_protection([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)


class TestOverlyPermissive(unittest.TestCase):
    def test_fails_with_write_all(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_overly_permissive([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)
            self.assertIn("write-all", result.errors[0].message)

    def test_warns_contents_write_on_ci(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "ci.yaml",
                """name: CI
permissions:
  contents: write
jobs:
  test:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_overly_permissive([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("contents: write", result.warnings[0].message)

    def test_allows_contents_write_on_release(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "release.yaml",
                """name: Release
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_overly_permissive([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)
            self.assertEqual(len(result.errors), 0)


class TestUnpinnedActions(unittest.TestCase):
    def test_warns_on_main_branch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@main
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_unpinned_actions([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("main", result.warnings[0].message)

    def test_warns_on_master_branch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@master
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_unpinned_actions([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)

    def test_passes_with_version_tag(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "good.yaml",
                """name: Good
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: some-org/some-action@v1.2.3
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_unpinned_actions([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 0)
            self.assertIn("No actions pinned to master/main", output)


class TestDangerousPatterns(unittest.TestCase):
    def test_fails_on_untrusted_body_input(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
on:
  issue_comment:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ github.event.comment.body }}"
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_dangerous_patterns([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)
            self.assertIn("untrusted input", result.errors[0].message)

    def test_fails_on_pr_title_injection(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "bad.yaml",
                """name: Bad
on:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ github.event.pull_request.title }}"
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_dangerous_patterns([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)

    def test_warns_on_pull_request_target(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "risky.yaml",
                """name: Risky
on:
  pull_request_target:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_dangerous_patterns([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.warnings), 1)
            self.assertIn("pull_request_target", result.warnings[0].message)

    def test_fails_on_dangerous_pr_target_checkout(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "dangerous.yaml",
                """name: Dangerous
on:
  pull_request_target:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_dangerous_patterns([workflow], result, out)
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 1)
            self.assertIn("high risk", result.errors[0].message)

    def test_passes_safe_workflow(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workflow = create_workflow(
                Path(tmpdir),
                "safe.yaml",
                """name: Safe
on:
  push:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Hello"
""",
            )
            result = AuditResult()
            out = create_silent_output()

            sys.stdout = io.StringIO()
            check_dangerous_patterns([workflow], result, out)
            output = sys.stdout.getvalue()
            sys.stdout = sys.__stdout__

            self.assertEqual(len(result.errors), 0)
            self.assertEqual(len(result.warnings), 0)
            self.assertIn("No obviously dangerous patterns", output)


class TestGitHubActionsOutput(unittest.TestCase):
    def test_error_annotation_format(self):
        out = Output(github_actions=True, use_colors=False)

        sys.stdout = io.StringIO()
        out.error("Test error", file="test.yaml", line=10)
        output = sys.stdout.getvalue()
        sys.stdout = sys.__stdout__

        self.assertIn("::error file=.github/workflows/test.yaml,line=10::Test error", output)

    def test_warning_annotation_format(self):
        out = Output(github_actions=True, use_colors=False)

        sys.stdout = io.StringIO()
        out.warning("Test warning", file="test.yaml")
        output = sys.stdout.getvalue()
        sys.stdout = sys.__stdout__

        self.assertIn("::warning file=.github/workflows/test.yaml::Test warning", output)


if __name__ == "__main__":
    unittest.main()
