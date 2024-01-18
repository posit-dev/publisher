# quarto-proj-py

A minimal Quarto project with a Python code block and the Jupyter runtime.

## Creation and Contents

- The RStudio IDE project and Quarto project were created using the IDE. This is the default project with Python/Jupyter.
- The `manifest.json` was pulled from the source bundle after using push-button deployment in the IDE.
    - It was manually edited to remove `.Rprofile` and `packrat.lock`, which are (at time of writing, 2022-02-09) automatically added by the IDE.
    - Also removed the R `packages` object from the manifest. By default, in the IDE, Python-only Quarto projects use `reticulate`, but this isn't necessary.
- Uses Python 3.8.12.

## Notes

- The empty `requirements.txt` file seems to be required for manifest-only deployment, the `bdgm` commands use.
