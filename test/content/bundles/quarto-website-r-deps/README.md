# quarto-website-r-deps

A Quarto website with an R/knitr runtime and a dependency that isn't found on our dev images (specifically `rsample`).

## Creation and Contents

- This project was created by duplicating `quarto-website-r` and making edits.
- `index.qmd` was edited to use the `rsample` package, which requires an install on dev images.
- The `manifest.json` was extracted from the source bundle after using push-button deployment in the IDE. It was edited to remove IDE files that don't exist in the bundle.
- Non-dev-default dependencies:
  - `rsample` (R)

## `quarto inspect`

```json
{
  "quarto": {
    "version": "0.9.16"
  },
  "engines": [
    "knitr"
  ],
  "config": {
    "project": {
      "type": "website",
      "lib-dir": "site_libs",
      "output-dir": "_site"
    },
    "website": {
      "title": "quarto-website-r-deps",
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
