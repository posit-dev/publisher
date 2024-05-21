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
	"github.com/stretchr/testify/suite"
)

type PostPackagesRScanSuite struct {
	utiltest.Suite
}

func TestPostPackagesRScanSuite(t *testing.T) {
	suite.Run(t, new(PostPackagesRScanSuite))
}

func (s *PostPackagesRScanSuite) TestNewPostPackagesRScanHandler() {
	base := util.NewAbsolutePath("/project", nil)
	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
	s.NotNil(h.inspector)
}

func (s *PostPackagesRScanSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	i := inspect.NewMockRInspector()
	i.On("CreateLockfile", destPath).Return(nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPEmptyBody() {
	rec := httptest.NewRecorder()
	body := strings.NewReader("")
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	i := inspect.NewMockRInspector()
	i.On("CreateLockfile", destPath).Return(nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveName() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":"my_renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("my_renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	i := inspect.NewMockRInspector()
	i.On("CreateLockfile", destPath).Return(nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPWithSaveNameInSubdir() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":".renv/profiles/staging/renv.lock"}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join(".renv", "profiles", "staging", "renv.lock")

	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	i := inspect.NewMockRInspector()
	i.On("CreateLockfile", destPath).Return(nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostPackagesRScanSuite) TestServeHTTPErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/packages/r/scan", body)
	s.NoError(err)

	base := util.NewAbsolutePath("/project", nil)
	destPath := base.Join("renv.lock")
	log := logging.New()
	h := NewPostPackagesRScanHandler(base, log)

	testError := errors.New("test error from ScanRequirements")
	i := inspect.NewMockRInspector()
	i.On("CreateLockfile", destPath).Return(testError)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}
