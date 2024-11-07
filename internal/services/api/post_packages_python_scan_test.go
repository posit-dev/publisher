package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
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

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()

	pkgs := []string{
		"numpy==1.22.3",
		"pandas",
	}
	incomplete := []string{
		"pandas",
	}
	i.On("ScanRequirements", mock.Anything).Return(pkgs, incomplete, "/usr/bin/python", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var res PostPackagesPythonScanResponse
	dec := json.NewDecoder(rec.Body)
	s.NoError(dec.Decode(&res))

	s.Equal(pkgs, res.Requirements)
	s.Equal(incomplete, res.Incomplete)
	s.Equal("/usr/bin/python", res.Python)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPEmptyBody() {
	rec := httptest.NewRecorder()
	body := strings.NewReader("")
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPWithSaveName() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"my_requirements.txt"}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("my_requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	testError := errors.New("test error from ScanRequirements")
	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, nil, "", testError)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	projectDir := base.Join("subproject", "subdir")
	err := projectDir.MkdirAll(0777)
	s.NoError(err)
	relProjectDir, err := projectDir.Rel(base)
	s.NoError(err)

	dirParam := url.QueryEscape(relProjectDir.String())
	req, err := http.NewRequest("POST", "/api/packages/python/scan?dir="+dirParam, body)
	s.NoError(err)

	destPath := projectDir.Join("requirements.txt")

	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, nil, "", nil)
	i.On("WriteRequirementsFile", destPath, mock.Anything).Return(nil)
	inspectorFactory = func(base util.AbsolutePath, python util.Path, log logging.Logger) inspect.PythonInspector {
		s.Equal(projectDir, base)
		return i
	}

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *PostPackagesPythonScanSuite) TestServeHTTPNoPythonErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/python/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	log := logging.New()
	h := NewPostPackagesPythonScanHandler(base, log)

	testError := types.NewAgentError(types.ErrorPythonExecNotFound, errors.New("no python"), nil)
	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, nil, "", testError)
	inspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector { return i }

	h.ServeHTTP(rec, req)
	resp, err := io.ReadAll(rec.Result().Body)
	s.NoError(err)
	s.Contains(string(resp), "{\"code\":\"pythonExecNotFound\"}")
	s.Equal(http.StatusUnprocessableEntity, rec.Result().StatusCode)
}
