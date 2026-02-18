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
	ContentTypePythonPanel      ContentType = "python-panel"
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
		ContentTypePythonPanel,
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
		ContentTypePythonPanel,
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

func (t ContentType) IsRContent() bool {
	switch t {
	case ContentTypeRPlumber,
		ContentTypeRShiny,
		ContentTypeRMarkdownShiny,
		ContentTypeRMarkdown:
		return true
	}
	return false
}
