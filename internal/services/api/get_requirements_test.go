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
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetRequirementsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestGetRequirementsSuite(t *testing.T) {
	suite.Run(t, new(GetRequirementsSuite))
}

func (s *GetRequirementsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetRequirementsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetRequirementsSuite) TestGetRequirements() {
	reqs := []byte("numpy\npandas\n")
	s.cwd.Join(inspect.PythonRequirementsFilename).WriteFile(reqs, 0666)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/requirements", nil)
	s.NoError(err)

	h := NewGetRequirementsHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := requirementsDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Requirements)
	s.Equal([]string{
		"numpy",
		"pandas",
	}, res.Requirements)
}
