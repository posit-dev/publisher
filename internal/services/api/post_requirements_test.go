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

type PostRequirementsSuite struct {
	utiltest.Suite
}

func TestPostRequirementsSuite(t *testing.T) {
	suite.Run(t, new(PostRequirementsSuite))
}

func (s *PostRequirementsSuite) TestNewPostRequirementsHandler() {
	base := util.NewPath("/project", nil)
	log := logging.New()
	h := NewPostRequirementsHandler(base, log)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
	s.NotNil(h.inspector)
}

func (s *PostRequirementsSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/requirements/inspect", body)
	s.NoError(err)

	base := util.NewPath("/project", nil)
	log := logging.New()
	h := NewPostRequirementsHandler(base, log)

	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", nil)
	i.On("WriteRequirementsFile", mock.Anything, mock.Anything).Return(nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *PostRequirementsSuite) TestServeHTTPErr() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"saveName":""}`)
	req, err := http.NewRequest("POST", "/api/requirements/inspect", body)
	s.NoError(err)

	base := util.NewPath("/project", nil)
	log := logging.New()
	h := NewPostRequirementsHandler(base, log)

	testError := errors.New("test error from ScanRequirements")
	i := inspect.NewMockPythonInspector()
	i.On("ScanRequirements", mock.Anything).Return(nil, "", testError)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}