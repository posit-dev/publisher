#!/usr/bin/env python3
"""Tests for generate_llms_txt.py script.

Run with: python3 scripts/test_generate_llms_txt.py
"""

import unittest
from pathlib import Path

from generate_llms_txt import (
    extract_content_types,
    generate_llms_full_txt,
    generate_llms_txt,
    strip_callouts,
    strip_frontmatter,
    strip_images,
)

DOCS_DIR = Path(__file__).parent.parent / "docs"


class TestStripFrontmatter(unittest.TestCase):
    def test_removes_frontmatter(self):
        text = "---\ntitle: Hello\n---\nContent here"
        self.assertEqual(strip_frontmatter(text), "Content here")

    def test_removes_leading_newlines_after_frontmatter(self):
        text = "---\ntitle: Hello\n---\n\n\nContent here"
        self.assertEqual(strip_frontmatter(text), "Content here")

    def test_no_frontmatter(self):
        text = "Just some content"
        self.assertEqual(strip_frontmatter(text), "Just some content")

    def test_unclosed_frontmatter(self):
        text = "---\ntitle: Hello\nContent here"
        self.assertEqual(strip_frontmatter(text), "---\ntitle: Hello\nContent here")


class TestStripImages(unittest.TestCase):
    def test_removes_image(self):
        text = "Before\n![alt](http://example.com/img.png)\nAfter"
        self.assertEqual(strip_images(text), "Before\nAfter")

    def test_removes_image_with_trailing_newline(self):
        text = "![](image.png)\nNext line"
        self.assertEqual(strip_images(text), "Next line")

    def test_preserves_regular_links(self):
        text = "[link text](http://example.com)"
        self.assertEqual(strip_images(text), "[link text](http://example.com)")


class TestStripCallouts(unittest.TestCase):
    def test_removes_tip_callout(self):
        text = "> [!TIP]\n> Some tip content"
        self.assertEqual(strip_callouts(text), "> Some tip content")

    def test_removes_warning_callout(self):
        text = "> [!WARNING]\n> Be careful"
        self.assertEqual(strip_callouts(text), "> Be careful")

    def test_preserves_regular_blockquotes(self):
        text = "> Just a quote"
        self.assertEqual(strip_callouts(text), "> Just a quote")


class TestExtractContentTypes(unittest.TestCase):
    def test_extracts_types_from_real_config(self):
        config_text = DOCS_DIR.joinpath("configuration.md").read_text()
        types = extract_content_types(config_text)
        self.assertIn("html", types)
        self.assertIn("python-shiny", types)
        self.assertIn("r-shiny", types)
        self.assertIn("jupyter-notebook", types)
        # Deprecated quarto (without suffix) should be excluded
        self.assertNotIn("quarto", types)
        # quarto-static should be included
        self.assertIn("quarto-static", types)

    def test_extracts_from_minimal_input(self):
        text = """#### type

Indicates the type of content being deployed. Valid values are:

- `html`
- `python-dash`
- `quarto` (Deprecated use `quarto-static` instead)
- `quarto-static`

#### entrypoint
"""
        types = extract_content_types(text)
        self.assertEqual(types, ["html", "python-dash", "quarto-static"])


class TestGenerateLlmsTxt(unittest.TestCase):
    def test_generates_valid_output(self):
        output = generate_llms_txt()
        # Starts with the expected header
        self.assertTrue(output.startswith("# Posit Publisher"))
        # Contains the docs section
        self.assertIn("## Docs", output)
        # Contains links to all pages
        self.assertIn("vscode.html", output)
        self.assertIn("configuration.html", output)
        self.assertIn("collaboration.html", output)
        self.assertIn("troubleshooting.html", output)
        # Contains the site URL
        self.assertIn("https://posit-dev.github.io/publisher/", output)
        # Contains content types section
        self.assertIn("## Supported Content Types", output)
        self.assertIn("- python-shiny", output)
        # Contains links section
        self.assertIn("## Links", output)
        self.assertIn("github.com/posit-dev/publisher", output)

    def test_ends_with_newline(self):
        output = generate_llms_txt()
        self.assertTrue(output.endswith("\n"))


class TestGenerateLlmsFullTxt(unittest.TestCase):
    def test_generates_valid_output(self):
        output = generate_llms_full_txt()
        # Starts with the expected header
        self.assertTrue(output.startswith("# Posit Publisher"))
        # Contains all major sections
        self.assertIn("## VS Code Extension Guide", output)
        self.assertIn("## Configuration File Reference", output)
        self.assertIn("## Collaborative Publishing", output)
        self.assertIn("## Troubleshooting", output)
        # Contains installation info from index.md
        self.assertIn("## Installation", output)
        # Section separators
        self.assertIn("---", output)

    def test_no_yaml_frontmatter(self):
        output = generate_llms_full_txt()
        # Should not contain any YAML frontmatter markers as content
        lines = output.splitlines()
        # The only --- should be section separators (not at line 0)
        self.assertNotEqual(lines[0], "---")

    def test_no_image_references(self):
        output = generate_llms_full_txt()
        self.assertNotIn("![", output)

    def test_contains_code_examples(self):
        output = generate_llms_full_txt()
        # Configuration examples should be preserved
        self.assertIn("```toml", output)


if __name__ == "__main__":
    unittest.main()
