package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"
)

type DeploymentSuite struct {
	utiltest.Suite
	log rslog.Logger
}

func TestDeploymentSuite(t *testing.T) {
	suite.Run(t, new(DeploymentSuite))
}

func (s *DeploymentSuite) SetupSuite() {
	s.log = rslog.NewDiscardingLogger()
}

func (s *DeploymentSuite) TestGet() {
	req, err := http.NewRequest("GET", "", nil)

	s.NoError(err)
	exp := state.NewDeployment()
	handler := NewDeploymentController(exp, s.log)

	w := httptest.NewRecorder()
	handler(w, req)
	s.Equal(200, w.Result().StatusCode)

	res := state.NewDeployment()
	decoder := json.NewDecoder(w.Result().Body)
	decoder.DisallowUnknownFields()
	err = decoder.Decode(res)
	s.NoError(err)

	s.Equal(exp, res)
}
