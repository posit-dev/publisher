package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostPackagesRScanSuite struct {
	utiltest.Suite
}

func TestPostPackagesRScanSuite(t *testing.T) {
	suite.Run(t, new(PostPackagesRScanSuite))
}

func (s *PostPackagesRScanSuite) SetupTest() {
}

func (s *PostPackagesRScanSuite) TestNewPostPackagesRScanHandler() {
	base := util.NewAbsolutePath("/project", nil)
	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log, nil)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
}

func (s *PostPackagesRScanSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"", "r": "/opt/R/bin/R"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	fs := afero.NewMemMapFs()
	base := util.NewAbsolutePath("/project", fs)
	err = base.MkdirAll(0777)
	s.NoError(err)

	lockFilePath := base.Join("renv.lock")

	log := logging.New()

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("CreateLockfile", lockFilePath).Return(nil)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, log, setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPEmptyBody() {
	rec := httptest.NewRecorder()
	body := strings.NewReader("")
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)

	log := logging.New()

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("CreateLockfile", mock.Anything).Return(nil)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, log, setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveName() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"my_renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	fs := afero.NewMemMapFs()
	base := util.NewAbsolutePath("/project", fs)
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("my_renv.lock")

	log := logging.New()

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("CreateLockfile", util.NewAbsolutePath(destPath.String(), fs)).Return(nil)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, log, setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveNameInSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":".renv/profiles/staging/renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	fs := afero.NewMemMapFs()
	base := util.NewAbsolutePath("/project", fs)
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join(".renv", "profiles", "staging", "renv.lock")

	log := logging.New()

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("CreateLockfile", destPath).Return(nil)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, log, setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("renv.lock")
	log := logging.New()

	testError := errors.New("test error from ScanRequirements")
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("CreateLockfile", destPath).Return(testError)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, log, setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)

	// Scanning a subdirectory two levels down
	fs := afero.NewMemMapFs()
	base := util.NewAbsolutePath("/project", fs)
	projectDir := base.Join("subproject", "subdir")
	err := projectDir.MkdirAll(0777)
	s.NoError(err)
	relProjectDir, err := projectDir.Rel(base)
	s.NoError(err)
	destPath := projectDir.Join("renv.lock")

	dirParam := url.QueryEscape(relProjectDir.String())
	req, err := http.NewRequest("POST", "/api/packages/r/scan?dir="+dirParam, body)
	s.NoError(err)

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("CreateLockfile", destPath).Return(nil)
		return i, nil
	}

	h := NewPostPackagesRScanHandler(base, logging.New(), setupMockRInterpreter)

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}
