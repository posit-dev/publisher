# quarto-website-r-py-deps

A Quarto website with R and Python code blocks in both files. It uses the knitr runtime. This project has dependencies outside of our usual dev environments.

## Creation and Contents

- This project was created by duplicating `quarto-website-r-py`.
- The `.qmd` files were edited to add dependencies.
- The `renv` was recreated and `requirements.txt` was edited.
- Non-dev-default dependencies:
  - `rsample` (R)
  - `pyyaml` (Python)

## `quarto inspect`

```json
{
  "quarto": {
    "version": "0.9.80"
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
      "title": "quarto-website-r-py-deps",
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

- `.here` is currently needed for `reticulate` to correctly detect the project root. [2022-03-03]
- This site previously used NumPy as its external dependency, but this caused BLAS incompatibility issues in local dev environments and on Dogfood. [2022-03-14]
