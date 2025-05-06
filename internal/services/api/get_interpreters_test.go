package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetInterpretersSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetInterpretersSuite(t *testing.T) {
	suite.Run(t, new(GetInterpretersSuite))
}

func (s *GetInterpretersSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetInterpretersSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetInterpretersSuite) createMockRInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(true)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("R", s.cwd.Fs()), nil)
	iMock.On("GetRVersion").Return("3.4.5", nil)
	relPath := util.NewRelativePath("renv.lock", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, true, nil)
	iMock.On("GetPackageManager").Return("renv")
	iMock.On("GetPreferredPath").Return("bin/my_r")
	iMock.On("GetRRequires").Return(">=3.1.1")
	return iMock
}

func (s *GetInterpretersSuite) createMockRMissingInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	missingError := types.NewAgentError(types.ErrorRExecNotFound, errors.New("no r"), nil)
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(false)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetRVersion").Return("", missingError)
	relPath := util.NewRelativePath("", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, false, missingError)
	iMock.On("GetPackageManager").Return("renv")
	iMock.On("GetPreferredPath").Return("bin/my_r")
	return iMock
}

func (s *GetInterpretersSuite) createMockPythonInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	iMock.On("IsPythonExecutableValid").Return(true)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("/bin/python", s.cwd.Fs()), nil)
	iMock.On("GetPythonVersion").Return("1.2.3", nil)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetPythonRequires").Return("")
	iMock.On("GetLockFilePath").Return("requirements.txt", true, nil)
	iMock.On("GetPreferredPath").Return("bin/my_python")
	return iMock
}

func (s *GetInterpretersSuite) createMockPythonMissingInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	missingError := types.NewAgentError(types.ErrorPythonExecNotFound, errors.New("no python"), nil)
	iMock.On("IsPythonExecutableValid").Return(false)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetPythonVersion").Return("", missingError)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetPythonRequires").Return("")
	iMock.On("GetLockFilePath").Return("", false, missingError)
	iMock.On("GetPreferredPath").Return("bin/my_python")
	return iMock
}

func (s *GetInterpretersSuite) TestGetInterpretersWhenPassedIn() {

	h := GetActiveInterpretersHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()

	// Base URL
	baseURL := "/api/interpreters"

	// Create a url.URL struct
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		panic(err)
	}

	// Create a url.Values to hold query parameters
	queryParams := url.Values{}
	queryParams.Add("dir", ".")
	queryParams.Add("r", "bin/my_r")
	queryParams.Add("python", "bin/my_python")

	// Encode query parameters and set them to the URL
	parsedURL.RawQuery = queryParams.Encode()

	req, err := http.NewRequest("GET", parsedURL.String(), nil)
	s.NoError(err)

	interpretersFromRequest = func(
		util.AbsolutePath,
		http.ResponseWriter,
		*http.Request,
		logging.Logger,
	) (interpreters.RInterpreter, interpreters.PythonInterpreter, error) {
		r := s.createMockRInterpreter()
		python := s.createMockPythonInterpreter()

		return r, python, nil
	}

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := getInterpreterResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	expectedPython := &config.Python{
		Version:               "1.2.3",
		PackageFile:           "requirements.txt",
		PackageManager:        "pip",
		RequiresPythonVersion: "",
	}
	expectedR := &config.R{
		Version:          "3.4.5",
		PackageFile:      "renv.lock",
		PackageManager:   "renv",
		RequiresRVersion: ">=3.1.1",
	}

	s.Equal(expectedPython, res.Python)
	s.Equal("bin/my_r", res.PreferredRPath)
	s.Equal(expectedR, res.R)
	s.Equal("bin/my_python", res.PreferredPythonPath)
}

func (s *GetInterpretersSuite) TestGetInterpretersWhenNoneFound() {

	h := GetActiveInterpretersHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()

	// Base URL
	baseURL := "/api/interpreters"

	// Create a url.URL struct
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		panic(err)
	}

	// Create a url.Values to hold query parameters
	queryParams := url.Values{}
	queryParams.Add("dir", ".")
	queryParams.Add("r", "bin/my_r")
	queryParams.Add("python", "bin/my_python")

	// Encode query parameters and set them to the URL
	parsedURL.RawQuery = queryParams.Encode()

	req, err := http.NewRequest("GET", parsedURL.String(), nil)
	s.NoError(err)

	interpretersFromRequest = func(
		util.AbsolutePath,
		http.ResponseWriter,
		*http.Request,
		logging.Logger,
	) (interpreters.RInterpreter, interpreters.PythonInterpreter, error) {
		r := s.createMockRMissingInterpreter()
		python := s.createMockPythonMissingInterpreter()

		return r, python, nil
	}

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := getInterpreterResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	expectedPython := &config.Python{
		Version:        "",
		PackageFile:    "",
		PackageManager: "",
	}
	expectedR := &config.R{
		Version:        "",
		PackageFile:    "",
		PackageManager: "",
	}

	s.Equal(expectedPython, res.Python)
	s.Equal("bin/my_r", res.PreferredRPath)
	s.Equal(expectedR, res.R)
	s.Equal("bin/my_python", res.PreferredPythonPath)
}
