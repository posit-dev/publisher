package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"log/slog"

	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PutDeploymentFilesHandlerFuncSuite struct {
	utiltest.Suite
	log *slog.Logger
}

func TestPutDeploymentFilesHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PutDeploymentFilesHandlerFuncSuite))
}

func (s *PutDeploymentFilesHandlerFuncSuite) SetupSuite() {
	s.log = slog.Default()
}

func (s *PutDeploymentFilesHandlerFuncSuite) TestPutDeploymentFilesHandlerFunc() {
	deploymentsService := new(MockDeploymentsService)
	h := PutDeploymentFilesHandlerFunc(deploymentsService, s.log)
	s.NotNil(h)
}

func (s *PutDeploymentFilesHandlerFuncSuite) TestPutDeploymentFilesHandler() {

	src := state.NewDeployment()
	deploymentsService := new(MockDeploymentsService)
	deploymentsService.On("SetDeploymentFiles", mock.Anything).Return(src)

	var b PutDeploymentFilesRequestBody = PutDeploymentFilesRequestBody{
		Files: []string{
			"app.py",
			"requirements.txt",
		},
	}
	j, _ := json.Marshal(b)
	br := bytes.NewReader(j)
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentFilesHandlerFunc(deploymentsService, s.log)

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

func (s *PutDeploymentFilesHandlerFuncSuite) TestPutDeploymentFilesHandlerFuncBadRequestJson() {

	deploymentsService := new(MockDeploymentsService)

	br := bytes.NewReader([]byte{})
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentFilesHandlerFunc(deploymentsService, s.log)

	rec := httptest.NewRecorder()

	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
