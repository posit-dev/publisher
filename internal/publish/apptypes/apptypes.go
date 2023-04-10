package apptypes

// Copyright (C) 2022 by Posit Software, PBC.

import (
	"fmt"
)

// Well-known values for ContentCategory.
const (
	CategoryPlot = "plot"
	CategoryBook = "book" // Deprecated; expect "site" now.
	CategorySite = "site"
	CategoryPin  = "pin"
)

type AppMode int32

const (
	UnknownMode AppMode = iota
	ShinyMode
	ShinyRmdMode
	StaticRmdMode
	StaticMode
	PlumberAPIMode
	TensorFlowModelAPI
	StaticJupyterMode
	PythonAPIMode
	PythonDashMode
	PythonStreamlitMode
	PythonBokehMode
	PythonFastAPIMode
	ShinyQuartoMode
	StaticQuartoMode
	PythonShinyMode
	JupyterVoilaMode
)

// UserAppModes is an enumeration of all app modes that can come from the user
// (it does not include UnknownMode).
var UserAppModes = [...]AppMode{
	ShinyMode,
	ShinyRmdMode,
	StaticRmdMode,
	StaticMode,
	PlumberAPIMode,
	TensorFlowModelAPI,
	StaticJupyterMode,
	PythonAPIMode,
	PythonDashMode,
	PythonStreamlitMode,
	PythonBokehMode,
	PythonFastAPIMode,
	ShinyQuartoMode,
	StaticQuartoMode,
	PythonShinyMode,
	JupyterVoilaMode,
}

type UnknownAppModeError struct {
	mode string
}

func (err UnknownAppModeError) Error() string {
	return fmt.Sprintf("Unrecognized app mode: %s", err.mode)
}

// AppModeFromString return the app mode numeric value corresponding to the
// provided string. UnknownMode and an error are returned if the string does
// not map to a known app mode.
func AppModeFromString(s string) (AppMode, error) {
	switch s {
	// Plumber APIs were historically the only API type for Connect. With the
	// addition of Python support, we now have multiple app modes that are
	// API content. Unfortunately, we have external dependencies that expect
	// the specific `api` appMode string for Plumber.
	case "api":
		return PlumberAPIMode, nil
	case "shiny":
		return ShinyMode, nil
	case "rmd-shiny":
		return ShinyRmdMode, nil
	case "rmd-static":
		return StaticRmdMode, nil
	case "jupyter-static":
		return StaticJupyterMode, nil
	case "static":
		return StaticMode, nil
	case "tensorflow-saved-model":
		return TensorFlowModelAPI, nil
	case "python-api":
		return PythonAPIMode, nil
	case "python-dash":
		return PythonDashMode, nil
	case "python-streamlit":
		return PythonStreamlitMode, nil
	case "python-bokeh":
		return PythonBokehMode, nil
	case "python-fastapi":
		return PythonFastAPIMode, nil
	case "python-shiny":
		return PythonShinyMode, nil
	case "quarto-shiny":
		return ShinyQuartoMode, nil
	case "quarto-static":
		return StaticQuartoMode, nil
	case "jupyter-voila":
		return JupyterVoilaMode, nil
	default:
		return UnknownMode, UnknownAppModeError{
			mode: s,
		}
	}
}

// AppModeToString reverses AppModeFromString; it is not AppMode#String()
// because most times we want to treat AppMode as numeric.
func AppModeToString(mode AppMode) string {
	switch mode {
	case PlumberAPIMode:
		return "api"
	case ShinyMode:
		return "shiny"
	case ShinyRmdMode:
		return "rmd-shiny"
	case StaticRmdMode:
		return "rmd-static"
	case StaticJupyterMode:
		return "jupyter-static"
	case StaticMode:
		return "static"
	case TensorFlowModelAPI:
		return "tensorflow-saved-model"
	case PythonAPIMode:
		return "python-api"
	case PythonDashMode:
		return "python-dash"
	case PythonStreamlitMode:
		return "python-streamlit"
	case PythonBokehMode:
		return "python-bokeh"
	case PythonFastAPIMode:
		return "python-fastapi"
	case PythonShinyMode:
		return "python-shiny"
	case ShinyQuartoMode:
		return "quarto-shiny"
	case StaticQuartoMode:
		return "quarto-static"
	case JupyterVoilaMode:
		return "jupyter-voila"
	default:
		return "unknown"
	}
}

// IsWorkerApp returns true for any content that is serviced by worker
// processes. This includes Shiny applications, interactive R Markdown
// documents, Plumber/Python (flask/fastapi) APIs, and Python apps
// (Dash, Streamlit, Bokeh, PyShiny, Voila).
func (mode AppMode) IsWorkerApp() bool {
	return (mode.IsShinyApp() ||
		mode.IsPythonApp() ||
		mode.IsAPIApp() ||
		mode.IsTensorFlowModelAPI())
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
func (mode AppMode) IsShinyApp() bool {
	return mode == ShinyMode || mode == ShinyRmdMode || mode == ShinyQuartoMode
}

// IsDashApp returns true for Python Dash applications
func (mode AppMode) IsDashApp() bool {
	return mode == PythonDashMode
}

// IsStreamlitApp returns true for Python Streamlit applications
func (mode AppMode) IsStreamlitApp() bool {
	return mode == PythonStreamlitMode
}

// IsBokehApp returns true for Python Bokeh applications
func (mode AppMode) IsBokehApp() bool {
	return mode == PythonBokehMode
}

// IsFastAPIApp returns true for Python FastAPI applications
func (mode AppMode) IsFastAPIApp() bool {
	return mode == PythonFastAPIMode
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
func (mode AppMode) IsStaticJupyter() bool {
	return mode == StaticJupyterMode
}

// IsStaticReport returns true for any non-interactive R or Jupyter content.
func (mode AppMode) IsStaticReport() bool {
	return mode == StaticRmdMode || mode == StaticJupyterMode || mode == StaticQuartoMode
}

// IsStaticContent returns true for any static content (deployed without
// source).
func (mode AppMode) IsStaticContent() bool {
	return mode == StaticMode
}

// IsTensorFlowModelAPI returns true for any TensorFlow Model API (deployed without source)
func (mode AppMode) IsTensorFlowModelAPI() bool {
	return mode == TensorFlowModelAPI
}

// IsRContent returns true if R is the primary interpreter for this content
// type.
func (mode AppMode) IsRContent() bool {
	switch mode {
	case ShinyMode, ShinyRmdMode, StaticRmdMode, PlumberAPIMode:
		return true
	}
	return false
}

// IsPythonContent returns true if Python is the primary interpreter for this
// content type.
func (mode AppMode) IsPythonContent() bool {
	switch mode {
	case StaticJupyterMode, PythonAPIMode, PythonDashMode, PythonStreamlitMode, PythonBokehMode, PythonFastAPIMode, PythonShinyMode, JupyterVoilaMode:
		return true
	}
	return false
}

// IsQuartoContent return true if Quarto is the primary driver of this content
// type.
func (mode AppMode) IsQuartoContent() bool {
	switch mode {
	case ShinyQuartoMode, StaticQuartoMode:
		return true
	}
	return false
}

func (mode AppMode) Description() string {
	switch mode {
	case UnknownMode:
		return "unknown content type"
	case ShinyMode:
		return "Shiny application"
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
	case TensorFlowModelAPI:
		return "TensorFlow model"
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
