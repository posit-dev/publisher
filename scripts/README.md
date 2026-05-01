# `/scripts`

Scripts for build and release operations, keeping the root [`Justfile`](../justfile) small.

- `get-version.bash` — Prints the current version from `package.json`.
- `is-pre-release.bash` — Exits 0 if the current version is a pre-release.
- `licenses.py` — Checks third-party license compliance.
- `prepare-release.py` — Automates release preparation (version bumps, changelog updates).

Tests for the Python scripts live alongside them (`test_licenses.py`, `test_prepare_release.py`) and run via `just test-scripts`.
