// Copyright (C) 2023 by Posit Software, PBC.

export enum AppMode {
    UNKNOWN = '',
    SHINY = 'shiny',
    RMD_SHINY = 'rmd-shiny',
    RMD_STATIC = 'rmd-static',
    STATIC = 'static',
    PLUMBER_API = 'api',
    JUPYTER_STATIC = 'jupyter-static',
    JUPYTER_VOILA = 'jupyter-voila',
    PYTHON_API = 'python-api',
    PYTHON_DASH = 'python-dash',
    PYTHON_STREAMLIT = 'python-streamlit',
    PYTHON_BOKEH = 'python-bokeh',
    PYTHON_FASTAPI = 'python-fastapi',
    PYTHON_SHINY = 'python-shiny',
    QUARTO_SHINY = 'quarto-shiny',
    QUARTO_STATIC = 'quarto-static',
}
