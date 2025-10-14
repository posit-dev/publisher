package contenttypes

// Copyright (C) 2025 by Posit Software, PBC.

type ContentType string

const (
	ContentTypeHTML             ContentType = "html"
	ContentTypeJupyterNotebook  ContentType = "jupyter-notebook"
	ContentTypeJupyterVoila     ContentType = "jupyter-voila"
	ContentTypePythonBokeh      ContentType = "python-bokeh"
	ContentTypePythonDash       ContentType = "python-dash"
	ContentTypePythonFastAPI    ContentType = "python-fastapi"
	ContentTypePythonFlask      ContentType = "python-flask"
	ContentTypePythonShiny      ContentType = "python-shiny"
	ContentTypePythonStreamlit  ContentType = "python-streamlit"
	ContentTypePythonGradio     ContentType = "python-gradio"
	ContentTypeQuartoShiny      ContentType = "quarto-shiny"
	ContentTypeQuartoDeprecated ContentType = "quarto"
	ContentTypeQuarto           ContentType = "quarto-static"
	ContentTypeRPlumber         ContentType = "r-plumber"
	ContentTypeRShiny           ContentType = "r-shiny"
	ContentTypeRMarkdownShiny   ContentType = "rmd-shiny"
	ContentTypeRMarkdown        ContentType = "rmd"
	ContentTypeUnknown          ContentType = "unknown"
)

func (t ContentType) IsPythonContent() bool {
	switch t {
	case
		ContentTypeJupyterNotebook,
		ContentTypeJupyterVoila,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonFastAPI,
		ContentTypePythonFlask,
		ContentTypePythonGradio,
		ContentTypePythonShiny,
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

func (t ContentType) IsAPIContent() bool {
	switch t {
	case ContentTypePythonFlask,
		ContentTypePythonFastAPI,
		ContentTypeRPlumber:
		return true
	}
	return false
}

func (t ContentType) IsAppContent() bool {
	switch t {
	case ContentTypePythonShiny,
		ContentTypeRShiny,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonGradio,
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

// Return a list of extra dependencies that should be included in the bundle
// for content types that sometimes do not include direct calls to dependency packages
// in user code (e.g. shiny apps that do not explicitly call library("shiny")).
func (t ContentType) ExtraDependencies(hasParameters bool, apiEngine string) []string {
	extraDeps := []string{}
	switch t {
	case ContentTypeRMarkdownShiny,
		ContentTypeQuartoShiny:
		extraDeps = append(extraDeps, "shiny", "rmarkdown")
	case ContentTypeQuarto,
		ContentTypeQuartoDeprecated,
		ContentTypeRMarkdown:
		extraDeps = append(extraDeps, "rmarkdown")
		if hasParameters {
			extraDeps = append(extraDeps, "shiny")
		}
	case ContentTypeRShiny:
		extraDeps = append(extraDeps, "shiny")
	case ContentTypeRPlumber:
		extraDeps = append(extraDeps, apiEngine)
	}
	return extraDeps
}
