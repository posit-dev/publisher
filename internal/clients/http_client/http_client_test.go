package http_client

import (
	"errors"
	"net/http"
	"testing"

	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2024 by Posit Software, PBC.

type HttpClientSuite struct {
	utiltest.Suite
}

func TestHttpClientSuite(t *testing.T) {
	suite.Run(t, new(HttpClientSuite))
}

func (s *HttpClientSuite) TestIsHTTPAgentErrorStatusOf() {
	agentErr := types.NewAgentError(
		events.DeploymentFailedCode,
		NewHTTPError("", "", http.StatusNotFound),
		nil,
	)

	// With a true agent error
	resultingErr, yesItIs := IsHTTPAgentErrorStatusOf(agentErr, http.StatusNotFound)
	s.Equal(yesItIs, true)
	s.Equal(agentErr, resultingErr)

	// With a true agent error, but a status that it is not
	resultingErr, yesItIs = IsHTTPAgentErrorStatusOf(agentErr, http.StatusBadGateway)
	s.Equal(yesItIs, false)
	s.Equal(agentErr, resultingErr)

	// With a non agent error
	resultingErr, yesItIs = IsHTTPAgentErrorStatusOf(errors.New("nope"), http.StatusNotFound)
	s.Equal(yesItIs, false)
	s.Nil(resultingErr)
}
