package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PutDeploymentTitleHandlerFuncSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestPutDeploymentTitleHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PutDeploymentTitleHandlerFuncSuite))
}

func (s *PutDeploymentTitleHandlerFuncSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PutDeploymentTitleHandlerFuncSuite) TestPutDeploymentTitleHandlerFunc() {
	deploymentsService := new(MockDeploymentsService)
	h := PutDeploymentTitleHandlerFunc(deploymentsService, s.log)
	s.NotNil(h)
}

func (s *PutDeploymentTitleHandlerFuncSuite) TestPutDeploymentTitleHandler() {

	src := state.NewDeployment()
	deploymentsService := new(MockDeploymentsService)
	deploymentsService.On("SetDeploymentTitle", mock.Anything).Return(src)

	var b PutDeploymentTitleRequestBody = PutDeploymentTitleRequestBody{
		Title: "new-title",
	}
	j, _ := json.Marshal(b)
	br := bytes.NewReader(j)
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentTitleHandlerFunc(deploymentsService, s.log)

	rec := httptest.NewRecorder()

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &state.Deployment{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(src, res)
}

func (s *PutDeploymentTitleHandlerFuncSuite) TestPutDeploymentTitleHandlerFuncBadRequestJson() {

	deploymentsService := new(MockDeploymentsService)

	br := bytes.NewReader([]byte{})
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentTitleHandlerFunc(deploymentsService, s.log)

	rec := httptest.NewRecorder()

	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
