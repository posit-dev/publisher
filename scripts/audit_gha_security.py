#!/usr/bin/env python3
"""
GitHub Actions Security Audit Script

This script checks for common security best practices in GitHub Actions workflows.
Run from the repository root: python scripts/audit-gha-security.py

Based on security hardening applied to posit-dev/publisher
"""

import os
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field


# ANSI color codes
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"  # No Color


@dataclass
class AuditResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    successes: list[str] = field(default_factory=list)


def error(result: AuditResult, message: str) -> None:
    result.errors.append(message)
    print(f"{Colors.RED}✗ ERROR:{Colors.NC} {message}")


def warning(result: AuditResult, message: str) -> None:
    result.warnings.append(message)
    print(f"{Colors.YELLOW}⚠ WARNING:{Colors.NC} {message}")


def success(message: str) -> None:
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")


def info(message: str) -> None:
    print(f"  {message}")


def get_workflow_files(workflows_dir: Path) -> list[Path]:
    """Get all YAML workflow files in the directory."""
    files = []
    for pattern in ["*.yaml", "*.yml"]:
        files.extend(workflows_dir.glob(pattern))
    return sorted(files)


def check_explicit_permissions(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 1: All workflows should have explicit permissions."""
    print("1. Checking for explicit permissions...")
    print("   (Workflows should declare minimum required permissions)")
    print()

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check for top-level permissions block
        if re.search(r"^permissions:", content, re.MULTILINE):
            success(f"{filename}: Has explicit permissions")
        else:
            error(result, f"{filename}: Missing top-level 'permissions:' block")
            info("  Add explicit permissions, e.g.:")
            info("    permissions:")
            info("      contents: read")
    print()


def check_secrets_inherit(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 2: No 'secrets: inherit' usage."""
    print("2. Checking for 'secrets: inherit' usage...")
    print("   (Should pass secrets explicitly to limit exposure)")
    print()

    inherit_found = False
    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if "secrets: inherit" in content:
            error(result, f"{filename}: Uses 'secrets: inherit' - pass secrets explicitly instead")
            # Show line numbers
            for i, line in enumerate(content.splitlines(), 1):
                if "secrets: inherit" in line:
                    info(f"  Line {i}: {line.strip()}")
            inherit_found = True

    if not inherit_found:
        success("No workflows use 'secrets: inherit'")
    print()


def check_fork_pr_protection(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 3: Fork PR protection for jobs using secrets."""
    print("3. Checking for fork PR protection on secret-using jobs...")
    print("   (Jobs using secrets should check: github.event.pull_request.head.repo.full_name == github.repository)")
    print()

    fork_check_pattern = r"github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository"

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check if workflow is triggered by pull_request (but not pull_request_target)
        if re.search(r"^\s*pull_request\s*:", content, re.MULTILINE) or \
           re.search(r"^\s+- pull_request\s*$", content, re.MULTILINE):
            # Check if workflow uses secrets in any form:
            # - Inline: ${{ secrets.FOO }}
            # - Passed to reusable workflow: secrets: (not empty)
            uses_inline_secrets = "${{ secrets." in content
            passes_secrets = (
                re.search(r"^\s+secrets:\s*$", content, re.MULTILINE) or
                re.search(r"^\s+secrets:\s*\n\s+\w+:", content, re.MULTILINE)
            )

            if uses_inline_secrets or passes_secrets:
                if re.search(fork_check_pattern, content):
                    success(f"{filename}: Has fork PR protection")
                else:
                    warning(result, f"{filename}: Triggered by pull_request and passes secrets, but may lack fork PR protection")
                    info("  Consider adding to jobs that use secrets:")
                    info("    if: github.event.pull_request.head.repo.full_name == github.repository")
    print()


def check_tag_ancestry_verification(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 4: Tag-triggered workflows should verify tag ancestry."""
    print("4. Checking tag-triggered workflows for ancestry verification...")
    print("   (Tag-triggered releases should verify tag points to main branch)")
    print()

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check if workflow is triggered by tag push
        if "tags:" in content and re.search(r'["\']?v\*', content):
            # Check if it verifies tag ancestry
            has_verification = (
                "merge-base --is-ancestor" in content or
                "verify-tag-ancestry" in content
            )
            if has_verification:
                success(f"{filename}: Tag-triggered workflow has ancestry verification")
            else:
                warning(result, f"{filename}: Tag-triggered workflow may lack ancestry verification")
                info("  Consider adding verification that tag points to main branch")
    print()


def check_workflow_dispatch_protection(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 5: Workflow dispatch on sensitive workflows."""
    print("5. Checking for workflow_dispatch on sensitive workflows...")
    print("   (Publish/release workflows should not allow manual dispatch without protection)")
    print()

    sensitive_patterns = re.compile(r"publish|release", re.IGNORECASE)

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if sensitive_patterns.search(filename):
            if "workflow_dispatch" in content:
                # Check for protection mechanisms
                has_protection = (
                    "environment:" in content or
                    "merge-base --is-ancestor" in content
                )
                if has_protection:
                    success(f"{filename}: Has workflow_dispatch with protection")
                else:
                    warning(result, f"{filename}: Publish/release workflow has workflow_dispatch without visible protection")
                    info("  Consider removing workflow_dispatch or adding environment protection")
            else:
                success(f"{filename}: No workflow_dispatch (good for release workflows)")
    print()


def check_overly_permissive(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 6: Overly permissive permissions."""
    print("6. Checking for overly permissive permissions...")
    print()

    checked_any = False
    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check for write-all
        if "permissions: write-all" in content:
            error(result, f"{filename}: Uses 'permissions: write-all' - too permissive")
            checked_any = True

        # Check for contents: write on non-release workflows
        if "contents: write" in content:
            if not re.search(r"release|license|publish", filename, re.IGNORECASE):
                warning(result, f"{filename}: Has 'contents: write' - verify this is necessary")
                checked_any = True

    if not checked_any:
        success("No overly permissive permissions found")
    print()


def check_unpinned_actions(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 7: Pinned action versions."""
    print("7. Checking for unpinned action versions...")
    print("   (Actions should use specific versions, not @master or @main)")
    print()

    unpinned_pattern = re.compile(r"uses:\s+([^/]+/[^@]+)@(master|main)\s*$", re.MULTILINE)
    unpinned_found = False

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        matches = unpinned_pattern.findall(content)
        if matches:
            warning(result, f"{filename}: Uses actions pinned to master/main branch")
            for action, branch in matches:
                info(f"  {action}@{branch}")
            unpinned_found = True

    if not unpinned_found:
        success("No actions pinned to master/main branches found")
    print()


def check_dangerous_patterns(workflows: list[Path], result: AuditResult) -> None:
    """CHECK 8: Dangerous patterns."""
    print("8. Checking for dangerous patterns...")
    print()

    # Pattern for untrusted input in expressions
    untrusted_input_pattern = re.compile(
        r"\$\{\{\s*github\.event\.(issue|pull_request|comment)\.(body|title)"
    )

    dangerous_found = False

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check for direct use of untrusted input
        if untrusted_input_pattern.search(content):
            error(result, f"{filename}: Potentially uses untrusted input directly (possible injection)")
            dangerous_found = True

        # Check for pull_request_target with checkout of PR code
        if "pull_request_target" in content:
            if "actions/checkout" in content:
                # Check if it checks out PR head
                if re.search(r"ref:.*\$\{\{.*pull_request", content):
                    error(result, f"{filename}: Uses pull_request_target with PR checkout - high risk pattern")
                    dangerous_found = True
                else:
                    warning(result, f"{filename}: Uses pull_request_target - review carefully")
                    dangerous_found = True

    if not dangerous_found:
        success("No obviously dangerous patterns found")
    print()


def main() -> int:
    """Run all security checks."""
    workflows_dir = Path(".github/workflows")

    print("=" * 40)
    print("GitHub Actions Security Audit")
    print("=" * 40)
    print()

    if not workflows_dir.is_dir():
        print(f"{Colors.RED}✗ ERROR:{Colors.NC} No .github/workflows directory found")
        return 1

    workflows = get_workflow_files(workflows_dir)
    if not workflows:
        print(f"{Colors.RED}✗ ERROR:{Colors.NC} No workflow files found")
        return 1

    result = AuditResult()

    # Run all checks
    check_explicit_permissions(workflows, result)
    check_secrets_inherit(workflows, result)
    check_fork_pr_protection(workflows, result)
    check_tag_ancestry_verification(workflows, result)
    check_workflow_dispatch_protection(workflows, result)
    check_overly_permissive(workflows, result)
    check_unpinned_actions(workflows, result)
    check_dangerous_patterns(workflows, result)

    # Summary
    print("=" * 40)
    print("Audit Summary")
    print("=" * 40)
    print(f"Errors:   {Colors.RED}{len(result.errors)}{Colors.NC}")
    print(f"Warnings: {Colors.YELLOW}{len(result.warnings)}{Colors.NC}")
    print()

    if result.errors:
        print(f"{Colors.RED}Security issues found that should be addressed.{Colors.NC}")
        return 1
    elif result.warnings:
        print(f"{Colors.YELLOW}Some warnings found - review recommended.{Colors.NC}")
        return 0
    else:
        print(f"{Colors.GREEN}All checks passed!{Colors.NC}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
