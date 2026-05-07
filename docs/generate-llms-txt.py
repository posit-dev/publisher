#!/usr/bin/env python3
"""Generate llms.txt and llms-full.txt from the documentation source files.

This script is intended to be run as a Quarto pre-render script, or manually
before committing documentation changes. It reads the .md source files and
produces:
  - llms.txt: concise overview with links to each page
  - llms-full.txt: full documentation content in a single file
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).parent
SITE_URL = "https://posit-dev.github.io/publisher"

# Pages in display order: (source_file, nav_title, description)
PAGES = [
    (
        "vscode.md",
        "VS Code Extension Guide",
        "Tutorial and reference for using the Posit Publisher extension in VS Code and Positron, including setup, deployment, credentials, project files, secrets, and packages.",
    ),
    (
        "configuration.md",
        "Configuration File Reference",
        "Complete reference for the .posit/publish/*.toml configuration file format, including all fields for Python, R, Quarto, Jupyter, Connect, and Connect Cloud settings.",
    ),
    (
        "collaboration.md",
        "Collaborative Publishing",
        "Guide for collaborating with others on deployed content using configuration and deployment files with or without source control.",
    ),
    (
        "troubleshooting.md",
        "Troubleshooting",
        "Common issues and solutions for Posit Publisher, including schema errors, network issues, renv problems, and deployment type mismatches.",
    ),
]


def strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter from markdown content."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3 :].lstrip("\n")
    return text


def strip_images(text: str) -> str:
    """Remove markdown image references (they aren't useful in plain text)."""
    return re.sub(r"!\[.*?\]\(.*?\)\n?", "", text)


def strip_callouts(text: str) -> str:
    """Convert GitHub-style callouts to plain text."""
    return re.sub(r"> \[!(TIP|NOTE|WARNING|IMPORTANT)\]\n", "", text)


def read_page(filename: str) -> str:
    """Read a markdown file and return cleaned content."""
    path = DOCS_DIR / filename
    text = path.read_text()
    text = strip_frontmatter(text)
    text = strip_images(text)
    text = strip_callouts(text)
    return text.strip()


def extract_content_types(config_text: str) -> list[str]:
    """Extract the content type list from configuration.md."""
    types = []
    in_type_list = False
    for line in config_text.splitlines():
        if line.strip() == "#### type":
            in_type_list = True
            continue
        if in_type_list:
            if line.startswith("- `") and not line.startswith("- `quarto`"):
                match = re.match(r"- `([^`]+)`", line)
                if match:
                    types.append(match.group(1))
            elif line.startswith("####") and in_type_list and types:
                break
    return types


def generate_llms_txt() -> str:
    """Generate the concise llms.txt content."""
    config_content = (DOCS_DIR / "configuration.md").read_text()
    content_types = extract_content_types(config_content)

    lines = [
        "# Posit Publisher",
        "",
        "> Posit Publisher is a VS Code and Positron extension that enables deploying Python and R projects to Posit Connect.",
        "",
        "Publisher presents a UI within the VS Code and Positron sidebar. Deployment options are set via configuration files in `.posit/publish/`, and records of deployments are kept in `.posit/publish/deployments`.",
        "",
        "## Docs",
        "",
    ]

    for filename, title, description in PAGES:
        html_name = filename.replace(".md", ".html")
        lines.append(
            f"- [{title}]({SITE_URL}/{html_name}): {description}"
        )

    lines += [
        "",
        "## Installation",
        "",
        "Install via the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher) or search for \"Posit Publisher\" in the VS Code Extensions view.",
        "",
        "Also available on the [Open VSX Registry](https://open-vsx.org/extension/posit/publisher).",
        "",
        "## Supported Content Types",
        "",
    ]

    for ct in content_types:
        lines.append(f"- {ct}")

    lines += [
        "",
        "## Links",
        "",
        "- [GitHub Repository](https://github.com/posit-dev/publisher)",
        "- [GitHub Issues](https://github.com/posit-dev/publisher/issues)",
        "- [GitHub Discussions](https://github.com/posit-dev/publisher/discussions)",
        "- [Posit Connect Documentation](https://docs.posit.co/connect/)",
        "- [Posit Connect Cloud Documentation](https://docs.posit.co/connect-cloud/)",
        "",
    ]

    return "\n".join(lines)


def generate_llms_full_txt() -> str:
    """Generate the full llms-full.txt content."""
    lines = [
        "# Posit Publisher",
        "",
        "> Posit Publisher is a VS Code and Positron extension that enables deploying Python and R projects to Posit Connect.",
        "",
        "Publisher presents a UI within the VS Code and Positron sidebar. Deployment options are set via configuration files in `.posit/publish/`, and records of deployments are kept in `.posit/publish/deployments`.",
        "",
        "For a full list of features and supported content types, see the [extension README](https://github.com/posit-dev/publisher/blob/main/extensions/vscode/README.md).",
        "",
    ]

    # Include index.md content (installation section)
    index_content = read_page("index.md")
    # Skip the first heading (redundant with our header) and the "Using/Config/Troubleshooting" link sections at the end
    index_lines = index_content.splitlines()
    # Find the Installation section
    for i, line in enumerate(index_lines):
        if line.startswith("## Installation"):
            # Include from Installation up to "## Using the Extension"
            section_lines = []
            for j in range(i, len(index_lines)):
                if index_lines[j].startswith("## Using") or index_lines[j].startswith("## Configuration Reference") or index_lines[j].startswith("## Troubleshooting"):
                    break
                section_lines.append(index_lines[j])
            lines.extend(section_lines)
            lines.append("")
            break

    # Add each page
    for filename, title, _ in PAGES:
        page_content = read_page(filename)
        lines.append("---")
        lines.append("")
        lines.append(f"## {title}")
        lines.append("")
        # Skip the first heading in the page content if it matches the title
        page_lines = page_content.splitlines()
        start = 0
        if page_lines and page_lines[0].startswith("# "):
            start = 1
            # Skip blank line after heading too
            if start < len(page_lines) and page_lines[start] == "":
                start += 1
        lines.extend(page_lines[start:])
        lines.append("")

    return "\n".join(lines)


def main():
    llms_txt = generate_llms_txt()
    llms_full_txt = generate_llms_full_txt()

    (DOCS_DIR / "llms.txt").write_text(llms_txt)
    (DOCS_DIR / "llms-full.txt").write_text(llms_full_txt)

    print("Generated llms.txt and llms-full.txt")


if __name__ == "__main__":
    main()
