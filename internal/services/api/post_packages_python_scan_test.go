package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostPackagesPythonScanSuite struct {
	utiltest.Suite
}

func TestPostRequirementsSuite(t *testing.T) {
	suite.Run(t, new(PostPackagesPythonScanSuite))
}

func (s *PostPackagesPythonScanSuite) SetupTest() {
	inspectorFactory = inspect.NewPythonInspector
}

func (s *PostPackagesPythonScanSuite) TestNewPostRequirementsHandler() {
	base := util.NewAbsolutePath("/project", nil)
	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPEmptyBody() {
	rec := httptest.NewRecorder()
	body := strings.NewReader("")
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPWithSaveName() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"my_requirements.txt"}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("my_requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	testError := errors.New("test error from ScanRequirements")
	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", testError)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}
