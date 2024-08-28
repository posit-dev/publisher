package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostPackagesRScanSuite struct {
	utiltest.Suite
}

func TestPostPackagesRScanSuite(t *testing.T) {
	suite.Run(t, new(PostPackagesRScanSuite))
}

func (s *PostPackagesRScanSuite) SetupTest() {
	rInspectorFactory = inspect.NewRInspector
}

func (s *PostPackagesRScanSuite) TestNewPostPackagesRScanHandler() {
	base := util.NewAbsolutePath("/project", nil)
	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
}

func (s *PostPackagesRScanSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"", "r": "/opt/R/bin/R"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	rInspectorFactory = func(baseDir util.AbsolutePath, rExec util.Path, log logging.Logger) inspect.RInspector {
		s.Equal(base, baseDir)
		s.Equal(util.NewPath("/opt/R/bin/R", nil), rExec)

		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(nil)
		return i
	}

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
	destPath := base.Join("renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	rInspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.RInspector {
		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(nil)
		return i
	}

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveName() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"my_renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join("my_renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	rInspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.RInspector {
		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(nil)
		return i
	}

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveNameInSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":".renv/profiles/staging/renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err = base.MkdirAll(0777)
	s.NoError(err)
	destPath := base.Join(".renv", "profiles", "staging", "renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	rInspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.RInspector {
		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(nil)
		return i
	}

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
	h := NewPostPackagesRScanHandler(base, log)

	testError := errors.New("test error from ScanRequirements")
	rInspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.RInspector {
		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(testError)
		return i
	}

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)

	// Scanning a subdirectory two levels down
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	projectDir := base.Join("subproject", "subdir")
	err := projectDir.MkdirAll(0777)
	s.NoError(err)
	relProjectDir, err := projectDir.Rel(base)
	s.NoError(err)

	dirParam := url.QueryEscape(relProjectDir.String())
	req, err := http.NewRequest("POST", "/api/packages/r/scan?dir="+dirParam, body)
	s.NoError(err)

	destPath := projectDir.Join("renv.lock")

	h := NewPostPackagesRScanHandler(base, logging.New())

	rInspectorFactory = func(base util.AbsolutePath, r util.Path, log logging.Logger) inspect.RInspector {
		s.Equal(projectDir, base)
		i := inspect.NewMockRInspector()
		i.On("CreateLockfile", destPath).Return(nil)
		return i
	}

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}
