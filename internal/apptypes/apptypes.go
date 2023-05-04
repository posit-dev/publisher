package apptypes

// Copyright (C) 2022 by Posit Software, PBC.

import (
	"fmt"
)

type AppMode string

// These values are the strings that will appear in manifest.json.
const (
	UnknownMode         AppMode = ""
	ShinyMode           AppMode = "shiny"
	ShinyRmdMode        AppMode = "rmd-shiny"
	StaticRmdMode       AppMode = "rmd-static"
	StaticMode          AppMode = "static"
	PlumberAPIMode      AppMode = "api"
	StaticJupyterMode   AppMode = "jupyter-static"
	PythonAPIMode       AppMode = "python-api"
	PythonDashMode      AppMode = "python-dash"
	PythonStreamlitMode AppMode = "python-streamlit"
	PythonBokehMode     AppMode = "python-bokeh"
	PythonFastAPIMode   AppMode = "python-fastapi"
	ShinyQuartoMode     AppMode = "quarto-shiny"
	StaticQuartoMode    AppMode = "quarto-static"
	PythonShinyMode     AppMode = "python-shiny"
	JupyterVoilaMode    AppMode = "jupyter-voila"
)

// AppModeFromString return the normalized string value corresponding to the
// provided string. UnknownMode and an error are returned if the string does
// not map to a known content type.
func AppModeFromString(s string) (AppMode, error) {
	switch s {
	// Plumber APIs were historically the only API type for Connect. With the
	// addition of Python support, we now have multiple content types that are
	// API content. Unfortunately, we have external dependencies that expect
	// the specific `api` string for Plumber.
	case "api", "plumber":
		return PlumberAPIMode, nil
	case "shiny":
		return ShinyMode, nil
	case "rmd-shiny", "shiny-rmd":
		return ShinyRmdMode, nil
	case "rmd-static", "rmd", "rmarkdown":
		return StaticRmdMode, nil
	case "jupyter-static", "jupyter", "notebook":
		return StaticJupyterMode, nil
	case "static", "html":
		return StaticMode, nil
	case "python-api", "flask", "wsgi":
		return PythonAPIMode, nil
	case "python-dash", "dash":
		return PythonDashMode, nil
	case "python-streamlit", "streamlit":
		return PythonStreamlitMode, nil
	case "python-bokeh", "bokeh":
		return PythonBokehMode, nil
	case "python-fastapi", "fastapi", "asgi":
		return PythonFastAPIMode, nil
	case "python-shiny", "pyshiny":
		return PythonShinyMode, nil
	case "quarto-shiny":
		return ShinyQuartoMode, nil
	case "quarto-static", "quarto":
		return StaticQuartoMode, nil
	case "jupyter-voila", "voila":
		return JupyterVoilaMode, nil
	case "", "unknown":
		return UnknownMode, nil
	default:
		return UnknownMode, fmt.Errorf("Unrecognized content type: %s", s)
	}
}

func (mode *AppMode) UnmarshalText(text []byte) error {
	value, err := AppModeFromString(string(text))
	if err != nil {
		return err
	}
	*mode = value
	return nil
}

// IsWorkerApp returns true for any content that is serviced by worker
// processes. This includes Shiny applications, interactive R Markdown
// documents, Plumber/Python (flask/fastapi) APIs, and Python apps
// (Dash, Streamlit, Bokeh, PyShiny, Voila).
func (mode AppMode) IsWorkerApp() bool {
	return (mode.IsShinyApp() ||
		mode.IsPythonApp() ||
		mode.IsAPIApp())
}

// IsAPIApp returns true for any API apps (currently, Plumber, Flask, or FastAPI).
func (mode AppMode) IsAPIApp() bool {
	return mode.IsPlumberAPI() || mode.IsPythonAPI()
}

// IsPlumberAPI returns true for Plumber API applications.
func (mode AppMode) IsPlumberAPI() bool {
	return mode == PlumberAPIMode
}

// IsPythonAPI returns true for Python API applications.
func (mode AppMode) IsPythonAPI() bool {
	return mode == PythonAPIMode || mode == PythonFastAPIMode
}

// IsPythonApp returns true for Python applications (Dash, Streamlit, Bokeh, Voila)
func (mode AppMode) IsPythonApp() bool {
	switch mode {
	case PythonDashMode, PythonStreamlitMode, PythonShinyMode, PythonBokehMode, JupyterVoilaMode:
		return true
	}
	return false
}

// IsShinyApp returns true for Shiny applications and interactive R Markdown
// documents.
func (t AppMode) IsShinyApp() bool {
	return t == ShinyMode || t == ShinyRmdMode || t == ShinyQuartoMode
}

// IsDashApp returns true for Python Dash applications
func (t AppMode) IsDashApp() bool {
	return t == PythonDashMode
}

// IsStreamlitApp returns true for Python Streamlit applications
func (t AppMode) IsStreamlitApp() bool {
	return t == PythonStreamlitMode
}

// IsBokehApp returns true for Python Bokeh applications
func (t AppMode) IsBokehApp() bool {
	return t == PythonBokehMode
}

// IsFastAPIApp returns true for Python FastAPI applications
func (t AppMode) IsFastAPIApp() bool {
	return t == PythonFastAPIMode
}

// IsPyShinyApp returns true for Python Shiny applications
func (mode AppMode) IsPyShinyApp() bool {
	return mode == PythonShinyMode
}

// IsVoilaApp returns true for Python Voila interactive notebooks
func (mode AppMode) IsVoilaApp() bool {
	return mode == JupyterVoilaMode
}

// IsStaticRmd returns true for any non-interactive R Markdown content.
func (mode AppMode) IsStaticRmd() bool {
	return mode == StaticRmdMode
}

// IsStaticJupyter returns true for any non-interactive Jupyter content.
func (t AppMode) IsStaticJupyter() bool {
	return t == StaticJupyterMode
}

// IsStaticReport returns true for any non-interactive R or Jupyter content.
func (t AppMode) IsStaticReport() bool {
	return t == StaticRmdMode || t == StaticJupyterMode || t == StaticQuartoMode
}

// IsStaticContent returns true for any static content (deployed without
// source).
func (t AppMode) IsStaticContent() bool {
	return t == StaticMode
}

// IsRContent returns true if R is the primary interpreter for this content
// type.
func (t AppMode) IsRContent() bool {
	switch t {
	case ShinyMode, ShinyRmdMode, StaticRmdMode, PlumberAPIMode:
		return true
	}
	return false
}

// IsPythonContent returns true if Python is the primary interpreter for this
// content type.
func (t AppMode) IsPythonContent() bool {
	switch t {
	case StaticJupyterMode, PythonAPIMode, PythonDashMode, PythonStreamlitMode, PythonBokehMode, PythonFastAPIMode, PythonShinyMode, JupyterVoilaMode:
		return true
	}
	return false
}

// IsQuartoContent return true if Quarto is the primary driver of this content
// type.
func (t AppMode) IsQuartoContent() bool {
	switch t {
	case ShinyQuartoMode, StaticQuartoMode:
		return true
	}
	return false
}

func (t AppMode) Description() string {
	switch t {
	case UnknownMode:
		return "unknown content type"
	case ShinyMode:
		return "R Shiny application"
	case ShinyRmdMode:
		return "Shiny R Markdown document"
	case StaticRmdMode:
		return "R Markdown document"
	case StaticJupyterMode:
		return "Jupyter notebook"
	case StaticMode:
		return "static content"
	case PlumberAPIMode:
		return "Plumber API"
	case PythonAPIMode:
		return "Python API"
	case PythonDashMode:
		return "Dash application"
	case PythonStreamlitMode:
		return "Streamlit application"
	case PythonBokehMode:
		return "Bokeh application"
	case PythonFastAPIMode:
		return "FastAPI application"
	case PythonShinyMode:
		return "Python Shiny application"
	case ShinyQuartoMode:
		return "Shiny Quarto document"
	case StaticQuartoMode:
		return "Quarto document"
	case JupyterVoilaMode:
		return "Voila interactive notebook"
	default:
		return "unknown content type"
	}
}
