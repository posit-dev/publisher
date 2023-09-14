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

func (s *PublishHandlerFuncSuite) TestPublishHandlerFunc() {
	publishArgs := &cli_types.PublishArgs{
		State: state.NewDeployment(),
	}
	oldID := publishArgs.State.LocalID
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	publishFn = func(args *cli_types.PublishArgs, lister accounts.AccountList, log logging.Logger) error {
		s.NotNil(args)
		s.NotEqual(state.LocalDeploymentID(""), args.State.LocalID)
		return nil
	}
	handler := PostPublishHandlerFunc(publishArgs, nil, log)
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
