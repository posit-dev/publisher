# quarto-website-r-py

A minimal Quarto website with R and Python code blocks in both files. It uses the knitr runtime.

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
    "knitr"
  ],
  "config": {
    "project": {
      "type": "website",
      "lib-dir": "site_libs",
      "output-dir": "_site"
    },
    "website": {
      "title": "quarto-website-r-py",
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

- The empty `requirements.txt` file is needed for Python environment restoration.
- There's currently (as of 2022-02-16) a warning in the logs — it looks like `reticulate` might think the project uses `poetry` for its project management. I'm going to file an issue about this. The error message happens during render.
  - This is due to `here()` detecting the project root as `/connect` in dev environments. Adding the `.here` file should have fixed this. [2022-03-03]
