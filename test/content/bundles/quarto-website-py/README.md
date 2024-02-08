# quarto-website-py

A minimal Quarto website with a Python/Jupyter runtime

## Creation and Contents

- This project was created by making a new Quarto website in the IDE and selecting selecting Jupyter as the runtime.
- The `manifest.json` was extracted from the source bundle after using push-button deployment in the IDE. It was edited to remove the `packages` object.

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
      "title": "quarto-website-py",
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
