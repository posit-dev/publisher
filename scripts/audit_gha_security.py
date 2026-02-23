#!/usr/bin/env python3
"""
GitHub Actions Security Audit Script

This script checks for common security best practices in GitHub Actions workflows.
Run from the repository root: python scripts/audit_gha_security.py

Supports both local CLI usage and GitHub Actions integration.

Usage:
    # Local usage with colors
    python scripts/audit_gha_security.py

    # GitHub Actions (auto-detected via GITHUB_ACTIONS env var)
    # Outputs annotations, step summary, and sets outputs

    # JSON output for programmatic use
    python scripts/audit_gha_security.py --format json

    # Explicit GitHub Actions mode
    python scripts/audit_gha_security.py --github-actions
"""

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class Finding:
    """A single security finding."""

    level: str  # "error" or "warning"
    check: str  # Which check found this
    file: str  # Workflow filename
    message: str  # Description of the issue
    line: Optional[int] = None  # Line number if applicable
    suggestion: Optional[str] = None  # How to fix


@dataclass
class AuditResult:
    """Results from the security audit."""

    errors: list[Finding] = field(default_factory=list)
    warnings: list[Finding] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return len(self.errors)

    @property
    def warning_count(self) -> int:
        return len(self.warnings)

    @property
    def has_errors(self) -> bool:
        return self.error_count > 0

    @property
    def has_warnings(self) -> bool:
        return self.warning_count > 0


class Output:
    """Handles output formatting for different environments."""

    def __init__(self, github_actions: bool = False, use_colors: bool = True):
        self.github_actions = github_actions
        self.use_colors = use_colors and not github_actions
        self._summary_lines: list[str] = []

    # ANSI color codes
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    def _color(self, color: str, text: str) -> str:
        if self.use_colors:
            return f"{color}{text}{self.NC}"
        return text

    def error(self, message: str, file: Optional[str] = None, line: Optional[int] = None) -> None:
        if self.github_actions:
            location = ""
            if file:
                location = f" file=.github/workflows/{file}"
                if line:
                    location += f",line={line}"
            print(f"::error{location}::{message}")
        else:
            print(f"{self._color(self.RED, '✗ ERROR:')} {message}")

    def warning(self, message: str, file: Optional[str] = None, line: Optional[int] = None) -> None:
        if self.github_actions:
            location = ""
            if file:
                location = f" file=.github/workflows/{file}"
                if line:
                    location += f",line={line}"
            print(f"::warning{location}::{message}")
        else:
            print(f"{self._color(self.YELLOW, '⚠ WARNING:')} {message}")

    def success(self, message: str) -> None:
        if self.github_actions:
            print(f"::notice::{message}")
        else:
            print(f"{self._color(self.GREEN, '✓')} {message}")

    def info(self, message: str) -> None:
        print(f"  {message}")

    def header(self, title: str) -> None:
        if self.github_actions:
            print(f"::group::{title}")
        else:
            print(title)

    def end_group(self) -> None:
        if self.github_actions:
            print("::endgroup::")
        else:
            print()

    def section(self, title: str) -> None:
        print(title)

    def add_summary(self, line: str) -> None:
        """Add a line to the GitHub Actions step summary."""
        self._summary_lines.append(line)

    def write_summary(self, result: AuditResult) -> None:
        """Write the step summary to GITHUB_STEP_SUMMARY."""
        if not self.github_actions:
            return

        summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
        if not summary_file:
            return

        lines = [
            "## 🔒 GitHub Actions Security Audit",
            "",
            f"| Result | Count |",
            f"|--------|-------|",
            f"| ❌ Errors | {result.error_count} |",
            f"| ⚠️ Warnings | {result.warning_count} |",
            f"| ✅ Passed | {len(result.passed)} |",
            "",
        ]

        if result.errors:
            lines.append("### Errors")
            lines.append("")
            for finding in result.errors:
                lines.append(f"- **{finding.file}**: {finding.message}")
            lines.append("")

        if result.warnings:
            lines.append("### Warnings")
            lines.append("")
            for finding in result.warnings:
                lines.append(f"- **{finding.file}**: {finding.message}")
            lines.append("")

        if not result.errors and not result.warnings:
            lines.append("✅ All security checks passed!")
            lines.append("")

        with open(summary_file, "a") as f:
            f.write("\n".join(lines))

    def set_output(self, name: str, value: str) -> None:
        """Set a GitHub Actions output variable."""
        if not self.github_actions:
            return

        output_file = os.environ.get("GITHUB_OUTPUT")
        if output_file:
            with open(output_file, "a") as f:
                f.write(f"{name}={value}\n")


def get_workflow_files(workflows_dir: Path) -> list[Path]:
    """Get all YAML workflow files in the directory."""
    files = []
    for pattern in ["*.yaml", "*.yml"]:
        files.extend(workflows_dir.glob(pattern))
    return sorted(files)


def find_line_number(content: str, pattern: str) -> Optional[int]:
    """Find the line number where a pattern first appears."""
    for i, line in enumerate(content.splitlines(), 1):
        if pattern in line:
            return i
    return None


def check_explicit_permissions(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 1: All workflows should have explicit permissions."""
    out.header("1. Checking for explicit permissions...")
    out.section("   (Workflows should declare minimum required permissions)")

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if re.search(r"^permissions:", content, re.MULTILINE):
            out.success(f"{filename}: Has explicit permissions")
            result.passed.append(f"{filename}: explicit permissions")
        else:
            finding = Finding(
                level="error",
                check="explicit-permissions",
                file=filename,
                message=f"Missing top-level 'permissions:' block",
                suggestion="Add explicit permissions, e.g.: permissions: { contents: read }",
            )
            result.errors.append(finding)
            out.error(finding.message, file=filename)
            out.info("  Add explicit permissions, e.g.:")
            out.info("    permissions:")
            out.info("      contents: read")

    out.end_group()


def check_secrets_inherit(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 2: No 'secrets: inherit' usage."""
    out.header("2. Checking for 'secrets: inherit' usage...")
    out.section("   (Should pass secrets explicitly to limit exposure)")

    inherit_found = False
    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if "secrets: inherit" in content:
            line_num = find_line_number(content, "secrets: inherit")
            finding = Finding(
                level="error",
                check="secrets-inherit",
                file=filename,
                message="Uses 'secrets: inherit' - pass secrets explicitly instead",
                line=line_num,
                suggestion="Replace 'secrets: inherit' with explicit secret passing",
            )
            result.errors.append(finding)
            out.error(finding.message, file=filename, line=line_num)
            inherit_found = True

    if not inherit_found:
        out.success("No workflows use 'secrets: inherit'")
        result.passed.append("No secrets: inherit usage")

    out.end_group()


def check_fork_pr_protection(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 3: Fork PR protection for jobs using secrets."""
    out.header("3. Checking for fork PR protection on secret-using jobs...")
    out.section(
        "   (Jobs using secrets should check: github.event.pull_request.head.repo.full_name == github.repository)"
    )

    fork_check_pattern = r"github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository"

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check if workflow is triggered by pull_request
        if re.search(r"^\s*pull_request\s*:", content, re.MULTILINE) or re.search(
            r"^\s+- pull_request\s*$", content, re.MULTILINE
        ):
            # Check if workflow uses secrets
            uses_inline_secrets = "${{ secrets." in content
            passes_secrets = re.search(
                r"^\s+secrets:\s*$", content, re.MULTILINE
            ) or re.search(r"^\s+secrets:\s*\n\s+\w+:", content, re.MULTILINE)

            if uses_inline_secrets or passes_secrets:
                if re.search(fork_check_pattern, content):
                    out.success(f"{filename}: Has fork PR protection")
                    result.passed.append(f"{filename}: fork PR protection")
                else:
                    finding = Finding(
                        level="warning",
                        check="fork-pr-protection",
                        file=filename,
                        message="Triggered by pull_request and uses secrets, but may lack fork PR protection",
                        suggestion="Add condition: if: github.event.pull_request.head.repo.full_name == github.repository",
                    )
                    result.warnings.append(finding)
                    out.warning(finding.message, file=filename)
                    out.info("  Consider adding to jobs that use secrets:")
                    out.info(
                        "    if: github.event.pull_request.head.repo.full_name == github.repository"
                    )

    out.end_group()


def check_tag_ancestry_verification(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 4: Tag-triggered workflows should verify tag ancestry."""
    out.header("4. Checking tag-triggered workflows for ancestry verification...")
    out.section("   (Tag-triggered releases should verify tag points to main branch)")

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check if workflow is triggered by tag push
        if "tags:" in content and re.search(r'["\']?v\*', content):
            has_verification = (
                "merge-base --is-ancestor" in content
                or "verify-tag-ancestry" in content
            )
            if has_verification:
                out.success(f"{filename}: Tag-triggered workflow has ancestry verification")
                result.passed.append(f"{filename}: tag ancestry verification")
            else:
                finding = Finding(
                    level="warning",
                    check="tag-ancestry",
                    file=filename,
                    message="Tag-triggered workflow may lack ancestry verification",
                    suggestion="Add verification that tag points to a commit on main branch",
                )
                result.warnings.append(finding)
                out.warning(finding.message, file=filename)
                out.info("  Consider adding verification that tag points to main branch")

    out.end_group()


def check_workflow_dispatch_protection(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 5: Workflow dispatch on sensitive workflows."""
    out.header("5. Checking for workflow_dispatch on sensitive workflows...")
    out.section(
        "   (Publish/release workflows should not allow manual dispatch without protection)"
    )

    sensitive_patterns = re.compile(r"publish|release", re.IGNORECASE)

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if sensitive_patterns.search(filename):
            if "workflow_dispatch" in content:
                has_protection = (
                    "environment:" in content
                    or "merge-base --is-ancestor" in content
                )
                if has_protection:
                    out.success(f"{filename}: Has workflow_dispatch with protection")
                    result.passed.append(f"{filename}: workflow_dispatch protected")
                else:
                    finding = Finding(
                        level="warning",
                        check="workflow-dispatch",
                        file=filename,
                        message="Publish/release workflow has workflow_dispatch without visible protection",
                        suggestion="Remove workflow_dispatch or add environment protection",
                    )
                    result.warnings.append(finding)
                    out.warning(finding.message, file=filename)
                    out.info(
                        "  Consider removing workflow_dispatch or adding environment protection"
                    )
            else:
                out.success(f"{filename}: No workflow_dispatch (good for release workflows)")
                result.passed.append(f"{filename}: no workflow_dispatch")

    out.end_group()


def check_overly_permissive(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 6: Overly permissive permissions."""
    out.header("6. Checking for overly permissive permissions...")

    checked_any = False
    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        if "permissions: write-all" in content:
            line_num = find_line_number(content, "permissions: write-all")
            finding = Finding(
                level="error",
                check="overly-permissive",
                file=filename,
                message="Uses 'permissions: write-all' - too permissive",
                line=line_num,
                suggestion="Use specific permissions instead of write-all",
            )
            result.errors.append(finding)
            out.error(finding.message, file=filename, line=line_num)
            checked_any = True

        if "contents: write" in content:
            if not re.search(r"release|license|publish", filename, re.IGNORECASE):
                finding = Finding(
                    level="warning",
                    check="overly-permissive",
                    file=filename,
                    message="Has 'contents: write' - verify this is necessary",
                    suggestion="Use 'contents: read' unless write access is required",
                )
                result.warnings.append(finding)
                out.warning(finding.message, file=filename)
                checked_any = True

    if not checked_any:
        out.success("No overly permissive permissions found")
        result.passed.append("No overly permissive permissions")

    out.end_group()


def check_unpinned_actions(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 7: Pinned action versions."""
    out.header("7. Checking for unpinned action versions...")
    out.section("   (Actions should use specific versions, not @master or @main)")

    unpinned_pattern = re.compile(
        r"uses:\s+([^/]+/[^@]+)@(master|main)\s*$", re.MULTILINE
    )
    unpinned_found = False

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        matches = unpinned_pattern.findall(content)
        if matches:
            for action, branch in matches:
                line_num = find_line_number(content, f"{action}@{branch}")
                finding = Finding(
                    level="warning",
                    check="unpinned-actions",
                    file=filename,
                    message=f"Uses action pinned to {branch} branch: {action}@{branch}",
                    line=line_num,
                    suggestion=f"Pin to a specific version or SHA instead of @{branch}",
                )
                result.warnings.append(finding)
                out.warning(finding.message, file=filename, line=line_num)
            unpinned_found = True

    if not unpinned_found:
        out.success("No actions pinned to master/main branches found")
        result.passed.append("All actions properly pinned")

    out.end_group()


def check_dangerous_patterns(
    workflows: list[Path], result: AuditResult, out: Output
) -> None:
    """CHECK 8: Dangerous patterns."""
    out.header("8. Checking for dangerous patterns...")

    untrusted_input_pattern = re.compile(
        r"\$\{\{\s*github\.event\.(issue|pull_request|comment)\.(body|title)"
    )

    dangerous_found = False

    for workflow in workflows:
        content = workflow.read_text()
        filename = workflow.name

        # Check for direct use of untrusted input
        match = untrusted_input_pattern.search(content)
        if match:
            line_num = find_line_number(content, match.group(0))
            finding = Finding(
                level="error",
                check="dangerous-patterns",
                file=filename,
                message="Potentially uses untrusted input directly (possible injection)",
                line=line_num,
                suggestion="Use an intermediate environment variable to sanitize input",
            )
            result.errors.append(finding)
            out.error(finding.message, file=filename, line=line_num)
            dangerous_found = True

        # Check for pull_request_target with checkout of PR code
        if "pull_request_target" in content:
            if "actions/checkout" in content:
                if re.search(r"ref:.*\$\{\{.*pull_request", content):
                    finding = Finding(
                        level="error",
                        check="dangerous-patterns",
                        file=filename,
                        message="Uses pull_request_target with PR checkout - high risk pattern",
                        suggestion="Avoid checking out PR code in pull_request_target workflows",
                    )
                    result.errors.append(finding)
                    out.error(finding.message, file=filename)
                    dangerous_found = True
                else:
                    finding = Finding(
                        level="warning",
                        check="dangerous-patterns",
                        file=filename,
                        message="Uses pull_request_target - review carefully",
                        suggestion="Ensure PR code is not executed with elevated permissions",
                    )
                    result.warnings.append(finding)
                    out.warning(finding.message, file=filename)
                    dangerous_found = True

    if not dangerous_found:
        out.success("No obviously dangerous patterns found")
        result.passed.append("No dangerous patterns")

    out.end_group()


def output_json(result: AuditResult) -> None:
    """Output results as JSON."""
    output = {
        "errors": [asdict(f) for f in result.errors],
        "warnings": [asdict(f) for f in result.warnings],
        "passed": result.passed,
        "summary": {
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "passed_count": len(result.passed),
            "has_errors": result.has_errors,
            "has_warnings": result.has_warnings,
        },
    }
    print(json.dumps(output, indent=2))


def main() -> int:
    """Run all security checks."""
    parser = argparse.ArgumentParser(
        description="Audit GitHub Actions workflows for security best practices"
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--github-actions",
        action="store_true",
        help="Enable GitHub Actions output mode (annotations, step summary)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--workflows-dir",
        type=Path,
        default=Path(".github/workflows"),
        help="Path to workflows directory (default: .github/workflows)",
    )
    args = parser.parse_args()

    # Auto-detect GitHub Actions environment
    is_github_actions = args.github_actions or os.environ.get("GITHUB_ACTIONS") == "true"

    # Determine if colors should be used
    use_colors = not args.no_color and sys.stdout.isatty() and not is_github_actions

    # For JSON output, we'll collect results silently
    if args.format == "json":
        out = Output(github_actions=False, use_colors=False)
        # Redirect stdout to suppress normal output
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
    else:
        out = Output(github_actions=is_github_actions, use_colors=use_colors)

    workflows_dir = args.workflows_dir

    if args.format != "json":
        print("=" * 40)
        print("GitHub Actions Security Audit")
        print("=" * 40)
        print()

    if not workflows_dir.is_dir():
        if args.format == "json":
            sys.stdout = old_stdout
            print(json.dumps({"error": "No .github/workflows directory found"}))
        else:
            out.error("No .github/workflows directory found")
        return 1

    workflows = get_workflow_files(workflows_dir)
    if not workflows:
        if args.format == "json":
            sys.stdout = old_stdout
            print(json.dumps({"error": "No workflow files found"}))
        else:
            out.error("No workflow files found")
        return 1

    result = AuditResult()

    # Run all checks
    check_explicit_permissions(workflows, result, out)
    check_secrets_inherit(workflows, result, out)
    check_fork_pr_protection(workflows, result, out)
    check_tag_ancestry_verification(workflows, result, out)
    check_workflow_dispatch_protection(workflows, result, out)
    check_overly_permissive(workflows, result, out)
    check_unpinned_actions(workflows, result, out)
    check_dangerous_patterns(workflows, result, out)

    # Handle JSON output
    if args.format == "json":
        sys.stdout = old_stdout
        output_json(result)
        return 1 if result.has_errors else 0

    # Summary
    print("=" * 40)
    print("Audit Summary")
    print("=" * 40)
    if use_colors:
        print(f"Errors:   {Output.RED}{result.error_count}{Output.NC}")
        print(f"Warnings: {Output.YELLOW}{result.warning_count}{Output.NC}")
    else:
        print(f"Errors:   {result.error_count}")
        print(f"Warnings: {result.warning_count}")
    print()

    # GitHub Actions outputs and summary
    if is_github_actions:
        out.set_output("error_count", str(result.error_count))
        out.set_output("warning_count", str(result.warning_count))
        out.set_output("has_errors", str(result.has_errors).lower())
        out.set_output("has_warnings", str(result.has_warnings).lower())
        out.write_summary(result)

    if result.has_errors:
        if use_colors:
            print(f"{Output.RED}Security issues found that should be addressed.{Output.NC}")
        else:
            print("Security issues found that should be addressed.")
        return 1
    elif result.has_warnings:
        if use_colors:
            print(f"{Output.YELLOW}Some warnings found - review recommended.{Output.NC}")
        else:
            print("Some warnings found - review recommended.")
        return 0
    else:
        if use_colors:
            print(f"{Output.GREEN}All checks passed!{Output.NC}")
        else:
            print("All checks passed!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
