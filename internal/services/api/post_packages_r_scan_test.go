package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
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

	fs := afero.NewMemMapFs()
	base := util.NewAbsolutePath("/project", fs)
	err = base.MkdirAll(0777)
	s.NoError(err)

	lockfilePath := base.Join("renv.lock")

	log := logging.New()

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", base.String(), "renv.lock", "/opt/R/bin/R").Return(lockfilePath, nil)

	h := NewPostPackagesRScanHandler(base, log)
	h.rDependencyScanner = mockScanner

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

	// Defaults to default lockfile name when none provided.
	lockfilePath := base.Join("renv.lock")

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", base.String(), "renv.lock", "").Return(lockfilePath, nil)

	h := NewPostPackagesRScanHandler(base, log)
	h.rDependencyScanner = mockScanner

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

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", base.String(), "my_renv.lock", "").Return(destPath, nil)

	h := NewPostPackagesRScanHandler(base, log)
	h.rDependencyScanner = mockScanner

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

	saveName := filepath.FromSlash(".renv/profiles/staging/renv.lock")
	destPath := base.Join(".renv", "profiles", "staging", "renv.lock")

	log := logging.New()

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", base.String(), saveName, "").Return(destPath, nil)

	h := NewPostPackagesRScanHandler(base, log)
	h.rDependencyScanner = mockScanner

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
	log := logging.New()

	testError := errors.New("test error from ScanRequirements")

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", base.String(), "renv.lock", "").Return(util.AbsolutePath{}, testError)

	h := NewPostPackagesRScanHandler(base, log)
	h.rDependencyScanner = mockScanner

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

	mockScanner := renv.NewMockRDependencyScanner()
	mockScanner.On("SetupRenvInDir", projectDir.String(), "renv.lock", "").Return(destPath, nil)

	h := NewPostPackagesRScanHandler(base, logging.New())
	h.rDependencyScanner = mockScanner

	h.ServeHTTP(rec, req)
	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}
