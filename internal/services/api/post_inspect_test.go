package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PostInspectHandlerFuncSuite struct {
	utiltest.Suite
	cwd                util.AbsolutePath
	log                logging.Logger
	mockConfigGetter   *mockConfigGetter
	mockMatchingWalker *mockMatchingWalker
}

func TestPostInspectHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PostInspectHandlerFuncSuite))
}

func (s *PostInspectHandlerFuncSuite) SetupTest() {
	afs := afero.NewMemMapFs()
	cwd, err := util.Getwd(afs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
	s.log = logging.New()

	s.mockConfigGetter = &mockConfigGetter{}
	s.mockMatchingWalker = &mockMatchingWalker{}

	// Create a test file that can be used as an entrypoint
	entrypointPath, _ := s.cwd.SafeJoin("index.rmd")
	entrypointPath.WriteFile([]byte("# Header"), 0644)
}

// Helper to create a simple configuration for testing
func createTestConfig() *config.Config {
	cfg := config.New()
	cfg.Type = config.ContentTypeRMarkdown
	cfg.Entrypoint = "index.rmd"
	return cfg
}

// Mock for initialize.Initialize interface
type mockConfigGetter struct {
	mock.Mock
}

func (m *mockConfigGetter) GetPossibleConfigs(
	path util.AbsolutePath,
	pythonPath util.Path,
	rPath util.Path,
	entrypoint util.RelativePath,
	log logging.Logger,
) ([]*config.Config, error) {
	args := m.Called(path, pythonPath, rPath, entrypoint, log)
	if configs, ok := args.Get(0).([]*config.Config); ok {
		return configs, args.Error(1)
	}
	return nil, args.Error(1)
}

// Mock for the MatchingWalker
type mockMatchingWalker struct {
	mock.Mock
}

func (m *mockMatchingWalker) Walk(root util.AbsolutePath, walkFn util.AbsoluteWalkFunc) error {
	args := m.Called(root, walkFn)
	return args.Error(0)
}

// Mock for NewMatchingWalker factory function
func (s *PostInspectHandlerFuncSuite) mockNewMatchingWalker(patterns []string, base util.AbsolutePath, log logging.Logger) (util.Walker, error) {
	return s.mockMatchingWalker, nil
}

// Helper to create a basic request for testing
func (s *PostInspectHandlerFuncSuite) createRequest(queryParams map[string]string) *http.Request {
	// Base URL
	baseURL := "/api/inspect"

	// Create a url.URL struct
	parsedURL, err := url.Parse(baseURL)
	s.NoError(err)

	// Create a url.Values to hold query parameters
	params := url.Values{}
	params.Add("dir", ".")
	for k, v := range queryParams {
		params.Add(k, v)
	}

	// Encode query parameters and set them to the URL
	parsedURL.RawQuery = params.Encode()

	req, err := http.NewRequest("POST", parsedURL.String(), nil)
	s.NoError(err)

	return req
}

func (s *PostInspectHandlerFuncSuite) TestPostInspectHandlerFunc() {
	// Create test configurations
	configs := []*config.Config{createTestConfig()}

	// Create request with Python and R interpreter paths
	req := s.createRequest(map[string]string{
		"dir":        ".",
		"entrypoint": "index.rmd",
		"python":     "/custom/bin/python3",
		"r":          "/custom/bin/R",
	})

	// Create Python and R interpreters
	pythonInterpreter := interpreters.NewMockPythonInterpreter()
	pythonPath := util.NewAbsolutePath("/custom/bin/python3", nil)
	pythonInterpreter.On("GetPythonExecutable").Return(pythonPath, nil)

	rInterpreter := interpreters.NewMockRInterpreter()
	rPath := util.NewAbsolutePath("/custom/bin/R", nil)
	rInterpreter.On("GetRExecutable").Return(rPath, nil)

	// Setup mock to return test configs and assert interpreter paths are used
	s.mockConfigGetter.On("GetPossibleConfigs",
		s.cwd,
		pythonPath.Path,
		rPath.Path,
		mock.Anything,
		s.log,
	).Return(configs, nil)

	// Create HTTP recorder
	rec := httptest.NewRecorder()

	// Create and call the handler
	handler := &postInspectHandler{
		base:           s.cwd,
		log:            s.log,
		initializer:    s.mockConfigGetter,
		matchingWalker: s.mockNewMatchingWalker,
		interpretersResolve: func(projectDir util.AbsolutePath, w http.ResponseWriter, req *http.Request, log logging.Logger) (interpreters.RInterpreter, interpreters.PythonInterpreter, error) {
			return rInterpreter, pythonInterpreter, nil
		},
	}

	// Call the handler
	handler.Handle(rec, req)

	// Verify response
	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	// Decode response body
	var response []postInspectResponseBody
	err := json.NewDecoder(rec.Body).Decode(&response)
	s.NoError(err)

	// Validate response content
	s.Len(response, 1)
	s.Equal(configs[0], response[0].Configuration)
	s.Equal(".", response[0].ProjectDir)

	// Verify mock calls
	s.mockConfigGetter.AssertExpectations(s.T())
	pythonInterpreter.AssertExpectations(s.T())
	rInterpreter.AssertExpectations(s.T())
}
