# quarto-website-py-deps

A Quarto website using the Python/Jupyter runtime, with a dependency that isn't pre-installed on our dev images (specifically `numpy`).

## Creation and Contents

- This project was created duplicating `quarto-website-py` and changing the Python code block in `index.qmd`.
- The `manifest.json` was extracted from the source bundle after using push-button deployment in the IDE. It was edited to remove the `packages` object and other R references.
- Non-dev-default dependencies:
  - `numpy` (Python)

## `quarto inspect`

```json
{
  "quarto": {
    "version": "0.9.16"
  },
  "engines": [
    "jupyter"
  ],
  "config": {
    "project": {
      "type": "website",
      "lib-dir": "site_libs",
      "output-dir": "_site"
    },
    "website": {
      "title": "quarto-website-py-deps",
      "navbar": {
        "background": "primary",
        "left": [
          {
            "href": "index.qmd",
            "text": "Home"
          },
          "about.qmd"
        ]
      }
    },
    "format": {
      "html": {
        "theme": "cosmo",
        "css": "styles.css"
      }
    },
    "editor": "visual",
    "language": {}
  }
}
```

## Notes

- The empty `requirements.txt` file seems to be required for manifest-only deployment of Python content, the `bdgm` commands use.
