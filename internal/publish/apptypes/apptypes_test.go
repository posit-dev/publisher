package apptypes

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AppTypesSuite struct {
	utiltest.Suite
}

func TestAppTypesSuite(t *testing.T) {
	suite.Run(t, new(AppTypesSuite))
}

func (s *AppTypesSuite) TestAppMode() {
	for _, each := range []struct {
		Mode AppMode
		// primary interpreter inference checks
		RContent      bool
		PythonContent bool
		QuartoContent bool
		// app-mode and "classification" checks
		WorkerApp     bool
		APIApp        bool
		PlumberAPI    bool
		PythonAPI     bool
		PythonApp     bool
		ShinyApp      bool
		DashApp       bool
		StreamlitApp  bool
		BokehApp      bool
		FastAPIApp    bool
		PyShinyApp    bool
		VoilaApp      bool
		StaticRmd     bool
		StaticJupyter bool
		StaticReport  bool
		StaticContent bool
	}{
		{
			Mode:          UnknownMode,
			RContent:      false,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     false,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          ShinyMode,
			RContent:      true,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      true,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          ShinyRmdMode,
			RContent:      true,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      true,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          StaticRmdMode,
			RContent:      true,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     false,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     true,
			StaticJupyter: false,
			StaticReport:  true,
			StaticContent: false,
		}, {
			Mode:          StaticMode,
			RContent:      false,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     false,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: true,
		}, {
			Mode:          PlumberAPIMode,
			RContent:      true,
			PythonContent: false,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        true,
			PlumberAPI:    true,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          StaticJupyterMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     false,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: true,
			StaticReport:  true,
			StaticContent: false,
		}, {
			Mode:          PythonAPIMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        true,
			PlumberAPI:    false,
			PythonAPI:     true,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          PythonDashMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     true,
			ShinyApp:      false,
			DashApp:       true,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          PythonStreamlitMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     true,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  true,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          PythonBokehMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     true,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      true,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          PythonFastAPIMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        true,
			PlumberAPI:    false,
			PythonAPI:     true,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    true,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          ShinyQuartoMode,
			RContent:      false,
			PythonContent: false,
			QuartoContent: true,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      true,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          StaticQuartoMode,
			RContent:      false,
			PythonContent: false,
			QuartoContent: true,
			WorkerApp:     false,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     false,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  true,
			StaticContent: false,
		}, {
			Mode:          PythonShinyMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     true,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    true,
			VoilaApp:      false,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		}, {
			Mode:          JupyterVoilaMode,
			RContent:      false,
			PythonContent: true,
			QuartoContent: false,
			WorkerApp:     true,
			APIApp:        false,
			PlumberAPI:    false,
			PythonAPI:     false,
			PythonApp:     true,
			ShinyApp:      false,
			DashApp:       false,
			StreamlitApp:  false,
			BokehApp:      false,
			FastAPIApp:    false,
			PyShinyApp:    false,
			VoilaApp:      true,
			StaticRmd:     false,
			StaticJupyter: false,
			StaticReport:  false,
			StaticContent: false,
		},
	} {
		comment := fmt.Sprintf("AppMode=%s (%s)", each.Mode, string(each.Mode))

		s.Equal(each.RContent, each.Mode.IsRContent(), comment)
		s.Equal(each.PythonContent, each.Mode.IsPythonContent(), comment)
		s.Equal(each.QuartoContent, each.Mode.IsQuartoContent(), comment)
		s.Equal(each.APIApp, each.Mode.IsAPIApp(), comment)
		s.Equal(each.PlumberAPI, each.Mode.IsPlumberAPI(), comment)
		s.Equal(each.PythonAPI, each.Mode.IsPythonAPI(), comment)
		s.Equal(each.PythonApp, each.Mode.IsPythonApp(), comment)
		s.Equal(each.ShinyApp, each.Mode.IsShinyApp(), comment)
		s.Equal(each.DashApp, each.Mode.IsDashApp(), comment)
		s.Equal(each.StreamlitApp, each.Mode.IsStreamlitApp(), comment)
		s.Equal(each.BokehApp, each.Mode.IsBokehApp(), comment)
		s.Equal(each.FastAPIApp, each.Mode.IsFastAPIApp(), comment)
		s.Equal(each.PyShinyApp, each.Mode.IsPyShinyApp(), comment)
		s.Equal(each.VoilaApp, each.Mode.IsVoilaApp(), comment)
		s.Equal(each.StaticRmd, each.Mode.IsStaticRmd(), comment)
		s.Equal(each.StaticJupyter, each.Mode.IsStaticJupyter(), comment)
		s.Equal(each.StaticReport, each.Mode.IsStaticReport(), comment)
		s.Equal(each.StaticContent, each.Mode.IsStaticContent(), comment)
	}
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
		{ShinyQuartoMode, "quarto-shiny"},
		{StaticQuartoMode, "quarto-static"},
		{PythonShinyMode, "python-shiny"},
		{JupyterVoilaMode, "jupyter-voila"},
	} {
		comment := fmt.Sprintf("AppMode=%s (%s)", each.Mode, each.String)
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

func (s *AppTypesSuite) TestDescription() {
	for _, each := range []struct {
		Mode        AppMode
		Description string
	}{
		{UnknownMode, "unknown content type"},
		{ShinyMode, "Shiny application"},
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
		{ShinyQuartoMode, "Shiny Quarto document"},
		{StaticQuartoMode, "Quarto document"},
		{PythonShinyMode, "Python Shiny application"},
		{JupyterVoilaMode, "Voila interactive notebook"},
	} {
		comment := fmt.Sprintf("AppMode=%s", each.Mode)
		s.Equal(each.Description, each.Mode.Description(), comment)
	}
}
