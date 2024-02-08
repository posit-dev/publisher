# quarto-website-r-py-separate-files

A minimal Quarto website with R and Python code blocks in separate files. It uses both knitr and Jupyter as runtimes.

## Creation and Contents

- This project was created by making a new Quarto website in the IDE and selecting selecting knitr as the runtime.
- The `.qmd` files were edited slightly.
- The `manifest.json` was extracted from the source bundle after using push-button deployment in the IDE. It was edited to remove IDE files that don't exist in the bundle.

## `quarto inspect`

```json
{
  "quarto": {
    "version": "0.9.16"
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
      "title": "quarto-website-r-py-separate-files",
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
}```

## Notes

- The empty `requirements.txt` file is needed for Python environment restoration.
