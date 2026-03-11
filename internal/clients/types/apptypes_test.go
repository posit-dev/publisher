package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type AppTypesSuite struct {
	utiltest.Suite
}

func TestAppTypesSuite(t *testing.T) {
	suite.Run(t, new(AppTypesSuite))
}

func (s *AppTypesSuite) TestIsStaticContent() {
	s.True(StaticMode.IsStaticContent())

	s.False(UnknownMode.IsStaticContent())
	s.False(ShinyMode.IsStaticContent())
	s.False(ShinyRmdMode.IsStaticContent())
	s.False(StaticRmdMode.IsStaticContent())
	s.False(PlumberAPIMode.IsStaticContent())
	s.False(StaticJupyterMode.IsStaticContent())
	s.False(PythonAPIMode.IsStaticContent())
	s.False(PythonDashMode.IsStaticContent())
	s.False(PythonStreamlitMode.IsStaticContent())
	s.False(PythonBokehMode.IsStaticContent())
	s.False(PythonFastAPIMode.IsStaticContent())
	s.False(PythonGradioMode.IsStaticContent())
	s.False(PythonPanelMode.IsStaticContent())
	s.False(ShinyQuartoMode.IsStaticContent())
	s.False(StaticQuartoMode.IsStaticContent())
	s.False(PythonShinyMode.IsStaticContent())
	s.False(JupyterVoilaMode.IsStaticContent())
}

func (s *AppTypesSuite) TestAppModeStrings() {
	// Check well-known values
	for _, each := range []struct {
		Mode   AppMode
		String string
	}{
		{ShinyMode, "shiny"},
		{ShinyRmdMode, "rmd-shiny"},
		{StaticRmdMode, "rmd-static"},
		{StaticMode, "static"},
		{PlumberAPIMode, "api"},
		{StaticJupyterMode, "jupyter-static"},
		{PythonAPIMode, "python-api"},
		{PythonDashMode, "python-dash"},
		{PythonStreamlitMode, "python-streamlit"},
		{PythonBokehMode, "python-bokeh"},
		{PythonFastAPIMode, "python-fastapi"},
		{PythonGradioMode, "python-gradio"},
		{PythonPanelMode, "python-panel"},
		{ShinyQuartoMode, "quarto-shiny"},
		{StaticQuartoMode, "quarto-static"},
		{PythonShinyMode, "python-shiny"},
		{JupyterVoilaMode, "jupyter-voila"},
		{UnknownMode, ""},
	} {
		comment := fmt.Sprintf("AppMode=%q (%s)", each.Mode, each.String)
		actual, err := AppModeFromString(each.String)
		s.Nil(err, comment)
		s.Equal(each.Mode, actual, comment)
		s.Equal(each.String, string(each.Mode), comment)
	}

	// Check garbage.
	actual, err := AppModeFromString("garbage")
	s.NotNil(err)
	s.Equal(UnknownMode, actual)

	s.Equal("", string(UnknownMode))
}

func (s *AppTypesSuite) TestUnmarshalText() {
	var mode AppMode
	err := mode.UnmarshalText([]byte("python-shiny"))
	s.Nil(err)
	s.Equal(mode, PythonShinyMode)
}

func (s *AppTypesSuite) TestUnmarshalTextInvalid() {
	var mode AppMode
	err := mode.UnmarshalText([]byte("invalid"))
	s.NotNil(err)
	s.ErrorContains(err, "unrecognized content type")
	s.ErrorContains(err, "invalid")
	s.Equal(mode, UnknownMode)
}

func (s *AppTypesSuite) TestDescription() {
	for _, each := range []struct {
		Mode        AppMode
		Description string
	}{
		{UnknownMode, "unknown content type"},
		{ShinyMode, "Shiny for R application"},
		{ShinyRmdMode, "Shiny R Markdown document"},
		{StaticRmdMode, "R Markdown document"},
		{StaticMode, "static content"},
		{PlumberAPIMode, "Plumber API"},
		{StaticJupyterMode, "Jupyter notebook"},
		{PythonAPIMode, "Python API"},
		{PythonDashMode, "Dash application"},
		{PythonStreamlitMode, "Streamlit application"},
		{PythonBokehMode, "Bokeh application"},
		{PythonFastAPIMode, "FastAPI application"},
		{PythonGradioMode, "Gradio application"},
		{PythonPanelMode, "Panel application"},
		{ShinyQuartoMode, "Shiny Quarto document"},
		{StaticQuartoMode, "Quarto document"},
		{PythonShinyMode, "Shiny for Python application"},
		{JupyterVoilaMode, "Voila interactive notebook"},
		{AppMode("invalid"), "unknown content type"},
	} {
		comment := fmt.Sprintf("AppMode=%s", each.Mode)
		s.Equal(each.Description, each.Mode.Description(), comment)
	}
}

func (s *AppTypesSuite) TestAppModeFromType() {
	s.Equal(PythonDashMode, AppModeFromType("python-dash"))
	s.Equal(ShinyMode, AppModeFromType("r-shiny"))
	s.Equal(StaticJupyterMode, AppModeFromType("jupyter-notebook"))
}

func (s *AppTypesSuite) TestAppModeFromTypeUnrecognized() {
	result := AppModeFromType("new-content-type")
	s.Equal(AppMode("new-content-type"), result)
	s.NotEqual(UnknownMode, result)
}

func (s *AppTypesSuite) TestAppModeIsKnown() {
	// Known modes (mapped in contentTypeConnectMap)
	s.True(ShinyMode.IsKnown())
	s.True(StaticRmdMode.IsKnown())
	s.True(PythonFastAPIMode.IsKnown())
	s.True(StaticMode.IsKnown())
	s.True(StaticJupyterMode.IsKnown())
	s.True(StaticQuartoMode.IsKnown())

	// Unknown modes (not in contentTypeConnectMap)
	s.False(UnknownMode.IsKnown())
	s.False(AppMode("unknown").IsKnown())
	s.False(AppMode("custom-type").IsKnown())
}
