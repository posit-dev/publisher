# quarto-website-r-py-separate-files-deps

A minimal Quarto website with R and Python code blocks in separate files. It uses both knitr and Jupyter as runtimes. Both engines require dependencies outside of the default dev libraries.

## Creation and Contents

- This project was started by duplicating `quarto-website-r-py-separate-files`.
- I edited the files to give the R and Python code blocks additional dependencies.
- I deleted and re-created the project's `renv` library, and edited `requirements.txt`.
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
    "knitr",
    "jupyter"
  ],
  "config": {
    "project": {
      "type": "website",
      "lib-dir": "site_libs",
      "output-dir": "_site"
    },
    "website": {
      "title": "quarto-website-r-py-separate-files-deps",
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
