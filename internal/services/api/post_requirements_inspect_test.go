package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostRequirementsInspectSuite struct {
	utiltest.Suite
}

func TestPostRequirementsInspectSuite(t *testing.T) {
	suite.Run(t, new(PostRequirementsInspectSuite))
}

func (s *PostRequirementsInspectSuite) TestNewPostRequirementsInspectHandler() {
	base := util.NewPath("/project", nil)
	log := logging.New()
	h := NewPostRequirementsInspectHandler(base, log)
	s.Equal(base, h.base)
	s.Equal(log, h.log)
	s.NotNil(h.inspector)
}

func (s *PostRequirementsInspectSuite) TestServeHTTP() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/requirements/inspect", nil)
	s.NoError(err)

	base := util.NewPath("/project", nil)
	log := logging.New()
	h := NewPostRequirementsInspectHandler(base, log)

	requirements := []string{"numpy==1.22.0", "flask"}
	i := inspect.NewMockPythonInspector()
	i.On("GetRequirements", mock.Anything).Return(requirements, "/path/to/python", nil)
	h.inspector = i

	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	res := PostRequirementsInspectResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	s.Equal(requirements, res.Requirements)
	s.Equal("/path/to/python", res.Python)
	s.Nil(res.Error)
}
