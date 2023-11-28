package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PutDeploymentAccountHandlerFuncSuite struct {
	utiltest.Suite
	log    logging.Logger
	lister *accounts.MockAccountList
}

func TestPutDeploymentAccountHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PutDeploymentAccountHandlerFuncSuite))
}

func (s *PutDeploymentAccountHandlerFuncSuite) SetupSuite() {
	s.log = logging.New()

	s.lister = accounts.NewMockAccountList()
	s.lister.On("GetAccountByName").Return([]accounts.Account{{
		Name:       "test",
		ServerType: accounts.ServerTypeConnect,
		URL:        "https://test.com",
	}}, nil)
}

func (s *PutDeploymentAccountHandlerFuncSuite) TestPutDeploymentAccountHandlerFunc() {
	deploymentsService := new(MockDeploymentsService)
	h := PutDeploymentAccountHandlerFunc(s.lister, deploymentsService, s.log)
	s.NotNil(h)
}

func (s *PutDeploymentAccountHandlerFuncSuite) TestPutDeploymentAccountHandler() {
	src := state.OldDeploymentFromState(state.Empty())
	deploymentsService := new(MockDeploymentsService)
	deploymentsService.On("SetDeploymentAccount", mock.Anything).Return(src)

	var b PutDeploymentAccountRequestBody = PutDeploymentAccountRequestBody{
		Account: "test",
	}
	j, _ := json.Marshal(b)
	br := bytes.NewReader(j)
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentAccountHandlerFunc(s.lister, deploymentsService, s.log)

	rec := httptest.NewRecorder()

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &state.OldDeployment{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(src, res)
}

func (s *PutDeploymentAccountHandlerFuncSuite) TestPutDeploymentAccountHandlerFuncBadRequestJson() {

	deploymentsService := new(MockDeploymentsService)

	br := bytes.NewReader([]byte{})
	req, err := http.NewRequest("PUT", "", br)
	s.NoError(err)

	h := PutDeploymentAccountHandlerFunc(s.lister, deploymentsService, s.log)

	rec := httptest.NewRecorder()

	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
