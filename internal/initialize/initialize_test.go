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
		rInspector.On("RequiresR").Return(requiredRReturnValue, requiredRError)
		return rInspector, nil
	}
}

func setupNewRInterpreterMock(
	base util.AbsolutePath,
	rExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride interpreters.ExistsFunc,
) (interpreters.RInterpreter, error) {
	i := interpreters.NewMockRInterpreter()
	i.On("Init").Return(nil)
	i.On("RequiresR", mock.Anything).Return(false, nil)
	i.On("GetLockFilePath").Return(util.RelativePath{}, false, nil)
	return i, nil
}

func (s *InitializeSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *InitializeSuite) TestInitEmpty() {
	// Empty directories can be initialized without error.
	log := logging.New()
	path := s.cwd.Join("My App")
	err := path.Mkdir(0777)
	s.NoError(err)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		inspect.NewPythonInspector,
		inspect.NewRInspector,
		setupNewRInterpreterMock,
	)

	cfg, err := i.Init(path, "", util.Path{}, util.Path{}, log)
	s.Nil(err)
	s.Equal(config.ContentTypeUnknown, cfg.Type)
	s.Equal("My App", cfg.Title)
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

func (s *InitializeSuite) createHTML() {
	appPath := s.cwd.Join("index.html")
	err := appPath.WriteFile([]byte(`
		<html></html>
	`), 0666)
	s.NoError(err)
}

func (s *InitializeSuite) createRequirementsFile() {
	appPath := s.cwd.Join("requirements.txt")
	err := appPath.WriteFile([]byte(`
		numpy
		pandas
	`), 0666)
	s.NoError(err)
}

var expectedPyConfig = &config.Python{
	Version:        "3.4.5",
	PackageManager: "pip",
	PackageFile:    "requirements.txt",
}

func makeMockPythonInspector(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector {
	pyInspector := inspect.NewMockPythonInspector()
	pyInspector.On("InspectPython").Return(expectedPyConfig, nil)
	return pyInspector
}

var expectedRConfig = &config.R{
	Version:        "1.2.3",
	PackageManager: "renv",
	PackageFile:    "renv.lock",
}

func (s *InitializeSuite) TestInitInferredType() {
	log := logging.New()
	s.createAppPy()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		makeMockPythonInspector,
		setupMockRInspector(false, nil),
		setupNewRInterpreterMock,
	)

	configName := ""
	cfg, err := i.Init(s.cwd, configName, util.Path{}, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg2, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(config.ContentTypePythonFlask, cfg.Type)
	s.Equal(expectedPyConfig, cfg.Python)
	s.Equal(cfg, cfg2)
}

func (s *InitializeSuite) TestInitRequirementsFile() {
	log := logging.New()
	s.createHTML()
	s.createRequirementsFile()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		makeMockPythonInspector,
		setupMockRInspector(false, nil),
		setupNewRInterpreterMock,
	)

	configName := ""
	cfg, err := i.Init(s.cwd, configName, util.Path{}, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg2, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypeHTML)
	s.Equal("3.4.5", cfg.Python.Version)
	s.Equal(cfg, cfg2)
}

func (s *InitializeSuite) TestInitIfNeededWhenNeeded() {
	log := logging.New()
	s.createAppPy()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		makeMockPythonInspector,
		setupMockRInspector(false, nil),
		setupNewRInterpreterMock,
	)

	configName := ""
	err := i.InitIfNeeded(s.cwd, configName, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypePythonFlask)
	s.Equal("3.4.5", cfg.Python.Version)
}

func (s *InitializeSuite) TestInitIfNeededWhenNotNeeded() {
	log := logging.New()
	configName := ""
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	cfg.WriteFile(configPath)
	cfg.FillDefaults()

	pythonInspectorFactory := func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector {
		return &inspect.MockPythonInspector{}
	}
	rInspectorFactory := func(util.AbsolutePath, util.Path, logging.Logger, interpreters.RInterpreterFactory, executor.Executor) (inspect.RInspector, error) {
		return &inspect.MockRInspector{}, nil
	}

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		pythonInspectorFactory,
		rInspectorFactory,
		setupNewRInterpreterMock,
	)

	err := i.InitIfNeeded(s.cwd, configName, log)
	s.NoError(err)
	newConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg, newConfig)
}

func (s *InitializeSuite) TestGetPossibleConfigs() {
	log := logging.New()
	appPy := s.createAppPy()
	exist, err := appPy.Exists()
	s.NoError(err)
	s.Equal(true, exist)
	appR := s.createAppR()
	exist, err = appR.Exists()
	s.NoError(err)
	s.Equal(true, exist)

	err = s.cwd.Join("index.html").WriteFile([]byte(`<html></html>`), 0666)
	s.NoError(err)

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		makeMockPythonInspector,
		setupMockRInspector(true, nil),
		setupNewRInterpreterMock,
	)

	configs, err := i.GetPossibleConfigs(s.cwd, util.Path{}, util.Path{}, util.RelativePath{}, log)
	s.NoError(err)

	s.Len(configs, 3)
	s.Equal(config.ContentTypeRShiny, configs[0].Type)
	s.Equal("app.R", configs[0].Entrypoint)
	s.Equal([]string{"/app.R", "/renv.lock"}, configs[0].Files)
	s.Equal(expectedRConfig, configs[0].R)

	s.Equal(config.ContentTypePythonFlask, configs[1].Type)
	s.Equal("app.py", configs[1].Entrypoint)
	s.Equal([]string{"/app.py", "/requirements.txt", "/renv.lock"}, configs[1].Files)
	s.Equal(expectedPyConfig, configs[1].Python)

	s.Equal(config.ContentTypeHTML, configs[2].Type)
	s.Equal("index.html", configs[2].Entrypoint)
	s.Equal([]string{"/index.html", "/renv.lock"}, configs[2].Files)
	s.Nil(configs[2].Python)
}

func (s *InitializeSuite) TestGetPossibleConfigsEmpty() {
	log := logging.New()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		inspect.NewPythonInspector,
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

func (s *InitializeSuite) TestGetPossibleConfigsWithMissingEntrypoint() {
	log := logging.New()
	s.createAppPy()

	i := NewInitialize(
		detectors.NewContentTypeDetector,
		inspect.NewPythonInspector,
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
		inspect.NewPythonInspector,
		inspect.NewRInspector,
		setupNewRInterpreterMock,
	)

	ep := util.NewRelativePath("notreal.py", s.cwd.Fs())
	i.normalizeConfig(cfg, s.cwd, util.Path{}, util.Path{}, ep, log)

	// Entrypoint is set from the relative path passed to normalizeConfig
	s.Equal("notreal.py", cfg.Entrypoint)
	s.Contains(cfg.Files, "/notreal.py")
}
