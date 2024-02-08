# quarto-proj-r-py

A minimal Quarto project that uses both R and Python. It uses the knitr runtime.

## Creation and Contents

- This project was created by copying `quarto-proj-r` and making a few changes:
    - Renamed things, obviously.
    - Added a basic Python code chunk, used comments to differentiate the code chunks.
    - Deleted and re-initialized `renv`.
- I published to a local dev instance of Connect with push-button publishing in the IDE, and grabbed the manifest from there.
- Created with R 3.6.3 and Python 3.8.12.

## Notes

- The empty `requirements.txt` file seems to be required for manifest-only deployment of Python content, the `bdgm` commands use.
