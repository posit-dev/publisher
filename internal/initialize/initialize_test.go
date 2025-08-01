package initialize

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/inspect/detectors"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

// TODO = initialize not currently testing R project

type InitializeSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestInitializeSuite(t *testing.T) {
	suite.Run(t, new(InitializeSuite))
}

func setupMockRInspector(requiredRReturnValue bool, requiredRError error) inspect.RInspectorFactory {
	return func(base util.AbsolutePath, rExecutable util.Path, log logging.Logger, rInterpreterFactoryOverride interpreters.RInterpreterFactory, cmdExecutorOverride executor.Executor) (inspect.RInspector, error) {
		rInspector := inspect.NewMockRInspector()
		rInspector.On("InspectR").Return(expectedRConfig, nil)
		rInspector.On("RequiresR", mock.Anything).Return(requiredRReturnValue, requiredRError)
		return rInspector, nil
	}
}

func setupMockPythonInspector(requiredPythonReturnValue bool, requiredPythonError error) inspect.PythonInspectorFactory {
	return func(base util.AbsolutePath, pythonExecutable util.Path, log logging.Logger, pythonInterpreterFactoryOverride interpreters.PythonInterpreterFactory, cmdExecutorOverride executor.Executor) (inspect.PythonInspector, error) {
		pythonInspector := inspect.NewMockPythonInspector()
		pythonInspector.On("InspectPython").Return(expectedPyConfig, nil)
		pythonInspector.On("RequiresPython", mock.Anything).Return(requiredPythonReturnValue, requiredPythonError)
		return pythonInspector, nil
	}
}

func setupNewRInterpreterMock(
	base util.AbsolutePath,
	rExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (interpreters.RInterpreter, error) {
	i := interpreters.NewMockRInterpreter()
	i.On("Init").Return(nil)
	i.On("RequiresR", mock.Anything).Return(false, nil)
	i.On("GetLockFilePath").Return(util.RelativePath{}, false, nil)
	return i, nil
}

func setupNewPythonInterpreterMock(
	base util.AbsolutePath,
	rExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (interpreters.PythonInterpreter, error) {
	i := interpreters.NewMockPythonInterpreter()
	i.On("IsPythonExecutableValid").Return(true)
	i.On("GetPythonExecutable").Return(util.RelativePath{}, nil)
	i.On("GetPythonVersion", mock.Anything).Return("", nil)

	return i, nil
}

func (s *InitializeSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *InitializeSuite) createAppPy() util.AbsolutePath {
	appPath := s.cwd.Join("app.py")
	err := appPath.WriteFile([]byte(`
		from flask import Flask
		app = Flask(__name__)
		app.run()
	`), 0666)
	s.NoError(err)
	return appPath
}

func (s *InitializeSuite) createAppR() util.AbsolutePath {
	appPath := s.cwd.Join("app.R")
	err := appPath.WriteFile([]byte(`
library(shiny)

# Define UI for application that draws a histogram
ui <- fluidPage(
  
  # Application title
  titlePanel("Old Faithful Geyser Data"),
  
  # Sidebar with a slider input for number of bins 
  sidebarLayout(
    sidebarPanel(
      sliderInput("bins",
                  "Number of bins:",
                  min = 1,
                  max = 50,
                  value = 30)
    ),
    
    # Show a plot of the generated distribution
    mainPanel(
      plotOutput("distPlot")
    )
  )
)

# Define server logic required to draw a histogram
server <- function(input, output) {
  
  output$distPlot <- renderPlot({
    # generate bins based on input$bins from ui.R
    x    <- faithful[, 2]
    bins <- seq(min(x), max(x), length.out = input$bins + 1)
    
    # draw the histogram with the specified number of bins
    hist(x, breaks = bins, col = 'darkgray', border = 'white')
  })
}

# Run the application 
shinyApp(ui = ui, server = server)
	`), 0666)
	s.NoError(err)
	return appPath
}

var emptyPyConfig = &config.Python{}

var expectedPyConfig = &config.Python{
	Version:        "3.4.5",
	PackageManager: "pip",
	PackageFile:    "requirements.txt",
}

var emptyRConfig = &config.R{}

var expectedRConfig = &config.R{
	Version:        "1.2.3",
	PackageManager: "renv",
	PackageFile:    "renv.lock",
}

func (s *InitializeSuite) TestGetPossibleRConfig() {
	log := logging.New()
	appR := s.createAppR()
	exist, err := appR.Exists()
	s.NoError(err)
	s.Equal(true, exist)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(false, nil),
		setupNewPythonInterpreterMock,
		setupMockRInspector(true, nil),
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeRShiny, configs[0].Type)
	s.Equal("app.R", configs[0].Entrypoint)
	s.Equal([]string{"/app.R", "/renv.lock"}, configs[0].Files)
	s.Equal(emptyRConfig, configs[0].R)
}

func (s *InitializeSuite) TestGetPossiblePythonConfig() {
	log := logging.New()
	appPy := s.createAppPy()
	exist, err := appPy.Exists()
	s.NoError(err)
	s.Equal(true, exist)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(true, nil),
		setupNewPythonInterpreterMock,
		setupMockRInspector(false, nil),
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypePythonFlask, configs[0].Type)
	s.Equal("app.py", configs[0].Entrypoint)
	s.Equal([]string{"/app.py", "/requirements.txt"}, configs[0].Files)
	s.Equal(emptyPyConfig, configs[0].Python)
}

func (s *InitializeSuite) TestGetPossibleHTMLConfig() {
	log := logging.New()
	err := s.cwd.Join("index.html").WriteFile([]byte(`<html></html>`), 0666)
	s.NoError(err)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(false, nil),
		setupNewPythonInterpreterMock,
		setupMockRInspector(false, nil),
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeHTML, configs[0].Type)
	s.Equal("index.html", configs[0].Entrypoint)
	s.Equal([]string{"/index.html"}, configs[0].Files)
	s.Nil(configs[0].Python)
}

func (s *InitializeSuite) TestGetPossibleConfigsEmpty() {
	log := logging.New()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(false, nil),
		setupNewPythonInterpreterMock,
		inspect.NewRInspector,
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeUnknown, configs[0].Type)
	s.Equal("unknown", configs[0].Entrypoint)
	s.Nil(configs[0].Python)
}

func (s *InitializeSuite) TestGetPossibleMultipleConfigs() {
	log := logging.New()

	appR := s.createAppR()
	exist, err := appR.Exists()
	s.NoError(err)
	s.Equal(true, exist)

	appPy := s.createAppPy()
	exist, err = appPy.Exists()
	s.NoError(err)
	s.Equal(true, exist)

	err = s.cwd.Join("index.html").WriteFile([]byte(`<html></html>`), 0666)
	s.NoError(err)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(true, nil),
		setupNewPythonInterpreterMock,
		setupMockRInspector(true, nil),
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 3)
}

func (s *InitializeSuite) TestGetPossibleConfigsWithMissingEntrypoint() {
	log := logging.New()
	s.createAppPy()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(false, nil),
		setupNewPythonInterpreterMock,
		inspect.NewRInspector,
		setupNewRInterpreterMock,
	)

	entrypoint := util.NewRelativePath("nonexistent.py", s.cwd.Fs())
	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, entrypoint, log)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeUnknown, configs[0].Type)
	s.Equal("nonexistent.py", configs[0].Entrypoint)
	s.Nil(configs[0].Python)
}

func (s *InitializeSuite) TestNormalizeConfigHandlesUnknownConfigs() {
	log := logging.New()

	cfg := config.New()
	cfg.Type = config.ContentTypeUnknown

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		setupMockPythonInspector(false, nil),
		setupNewPythonInterpreterMock,
		inspect.NewRInspector,
		setupNewRInterpreterMock,
	)

	ep := util.NewRelativePath("notreal.py", s.cwd.Fs())
	i.normalizeConfig(cfg, s.cwd, util.Path{}, util.Path{}, ep, log)

	// Entrypoint is set from the relative path passed to normalizeConfig
	s.Equal("notreal.py", cfg.Entrypoint)
	s.Contains(cfg.Files, "/notreal.py")
}
