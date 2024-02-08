# quarto-doc-none

A minimal Quarto document that uses no runtimes and exercises as little functionality as possible.

- The Quarto project was created using `quarto create-project` at the command line.
- An `.Rproj` file was created for resulting existing folder.
- The `manifest.json` was pulled from the source bundle after using push-button deployment in the IDE, and manually edited to remove `.Rprofile` and `packrat.lock`, which are (at time of writing, 2022-02-09) automatically added by the IDE.
