package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
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
	stateStore := &state.State{}
	oldID := stateStore.LocalID
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	lister := &accounts.MockAccountList{}
	handler := PostPublishHandlerFunc(util.Path{}, log, lister)
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &PostPublishReponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.NotEqual(state.LocalDeploymentID(""), stateStore.LocalID)
	s.NotEqual(oldID, stateStore.LocalID)
	s.Equal(stateStore.LocalID, res.LocalID)
}
