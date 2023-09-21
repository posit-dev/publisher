package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type PublishHandlerFuncSuite struct {
	utiltest.Suite
}

func TestPublishHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PublishHandlerFuncSuite))
}

type mockPublisher struct {
	suite *PublishHandlerFuncSuite
	args  *cli_types.PublishArgs
}

func (m *mockPublisher) PublishManifestFiles(lister accounts.AccountList, log logging.Logger) error {
	m.suite.NotNil(m.args)
	m.suite.NotNil(lister)
	m.suite.NotNil(log)
	m.suite.NotEqual(state.LocalDeploymentID(""), m.args.State.LocalID)
	return nil
}

func (s *PublishHandlerFuncSuite) TestPublishHandlerFunc() {
	publishArgs := &cli_types.PublishArgs{
		State: state.NewDeployment(),
	}
	oldID := publishArgs.State.LocalID
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	publisher := &mockPublisher{
		suite: s,
		args:  publishArgs,
	}
	lister := &accounts.MockAccountList{}
	handler := PostPublishHandlerFunc(publisher, publishArgs, lister, log)
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &PublishReponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.NotEqual(state.LocalDeploymentID(""), publishArgs.State.LocalID)
	s.NotEqual(oldID, publishArgs.State.LocalID)
	s.Equal(publishArgs.State.LocalID, res.LocalID)
}
