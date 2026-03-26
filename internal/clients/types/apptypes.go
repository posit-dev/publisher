package types

// Copyright (C) 2022 by Posit Software, PBC.

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/contenttypes"
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
	PythonGradioMode    AppMode = "python-gradio"
	PythonPanelMode     AppMode = "python-panel"
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
	case "python-gradio", "gradio":
		return PythonGradioMode, nil
	case "python-panel", "panel":
		return PythonPanelMode, nil
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
		return UnknownMode, fmt.Errorf("unrecognized content type: %s", s)
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

// IsStaticContent returns true for any static content (deployed without
// source).
func (t AppMode) IsStaticContent() bool {
	return t == StaticMode
}

// IsKnown returns true if this AppMode is a recognized, mapped content type.
// Returns false for unmapped content types that would create invalid API paths.
func (mode AppMode) IsKnown() bool {
	_, ok := contentTypeConnectMap[mode]
	return ok
}

func (t AppMode) Description() string {
	switch t {
	case UnknownMode:
		return "unknown content type"
	case ShinyMode:
		return "Shiny for R application"
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
	case PythonGradioMode:
		return "Gradio application"
	case PythonPanelMode:
		return "Panel application"
	case PythonShinyMode:
		return "Shiny for Python application"
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

var connectContentTypeMap = map[contenttypes.ContentType]AppMode{
	contenttypes.ContentTypeHTML:             StaticMode,
	contenttypes.ContentTypeJupyterNotebook:  StaticJupyterMode,
	contenttypes.ContentTypeJupyterVoila:     JupyterVoilaMode,
	contenttypes.ContentTypePythonBokeh:      PythonBokehMode,
	contenttypes.ContentTypePythonDash:       PythonDashMode,
	contenttypes.ContentTypePythonFastAPI:    PythonFastAPIMode,
	contenttypes.ContentTypePythonFlask:      PythonAPIMode,
	contenttypes.ContentTypePythonShiny:      PythonShinyMode,
	contenttypes.ContentTypePythonStreamlit:  PythonStreamlitMode,
	contenttypes.ContentTypePythonGradio:     PythonGradioMode,
	contenttypes.ContentTypePythonPanel:      PythonPanelMode,
	contenttypes.ContentTypeQuartoShiny:      ShinyQuartoMode,
	contenttypes.ContentTypeQuartoDeprecated: StaticQuartoMode,
	contenttypes.ContentTypeQuarto:           StaticQuartoMode,
	contenttypes.ContentTypeRPlumber:         PlumberAPIMode,
	contenttypes.ContentTypeRShiny:           ShinyMode,
	contenttypes.ContentTypeRMarkdownShiny:   ShinyRmdMode,
	contenttypes.ContentTypeRMarkdown:        StaticRmdMode,
}

func AppModeFromType(t contenttypes.ContentType) AppMode {
	mode, ok := connectContentTypeMap[t]
	if !ok {
		return AppMode(t)
	}
	return mode
}

var contentTypeConnectMap = map[AppMode]contenttypes.ContentType{
	StaticMode:          contenttypes.ContentTypeHTML,
	StaticJupyterMode:   contenttypes.ContentTypeJupyterNotebook,
	JupyterVoilaMode:    contenttypes.ContentTypeJupyterVoila,
	PythonBokehMode:     contenttypes.ContentTypePythonBokeh,
	PythonDashMode:      contenttypes.ContentTypePythonDash,
	PythonFastAPIMode:   contenttypes.ContentTypePythonFastAPI,
	PythonAPIMode:       contenttypes.ContentTypePythonFlask,
	PythonGradioMode:    contenttypes.ContentTypePythonGradio,
	PythonPanelMode:     contenttypes.ContentTypePythonPanel,
	PythonShinyMode:     contenttypes.ContentTypePythonShiny,
	PythonStreamlitMode: contenttypes.ContentTypePythonStreamlit,
	ShinyQuartoMode:     contenttypes.ContentTypeQuartoShiny,
	StaticQuartoMode:    contenttypes.ContentTypeQuarto,
	PlumberAPIMode:      contenttypes.ContentTypeRPlumber,
	ShinyMode:           contenttypes.ContentTypeRShiny,
	ShinyRmdMode:        contenttypes.ContentTypeRMarkdownShiny,
	StaticRmdMode:       contenttypes.ContentTypeRMarkdown,
}

func ContentTypeFromAppMode(a AppMode) contenttypes.ContentType {
	contentType, ok := contentTypeConnectMap[a]
	if !ok {
		contentType = contenttypes.ContentTypeUnknown
	}
	return contentType
}
