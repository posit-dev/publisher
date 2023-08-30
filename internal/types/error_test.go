package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ErrorSuite struct {
	utiltest.Suite
}

func TestErrorSuite(t *testing.T) {
	suite.Run(t, new(ErrorSuite))
}

func (s *ErrorSuite) TestError() {
	err := errors.New("an error occurred")
	agentErr := ErrToAgentError(Operation("testOp"), err)
	s.Equal(err.Error(), agentErr.Error())
}

func (s *ErrorSuite) TestUsage() {
	/// Typical workflow:
	// Caller creates a custom error using NewAgentError and attaches metadata
	code := ErrorCode("BadError")
	err := errors.New("an error occurred")
	details := struct {
		Metadata string
	}{"Some metadata"}
	op := Operation("MyOperation")
	agentErr := NewAgentError(code, err, &details)

	// Caller receives the returned error and attaches context
	agentErr.SetOperation(op)

	// Everything is available via the serialization getters
	s.Equal(err.Error(), agentErr.Error())
	s.Equal(agentErr.GetCode(), code)
	s.Equal(agentErr.GetData(), ErrorData{
		"Msg":      "an error occurred",
		"Metadata": "Some metadata",
	})
	s.Equal(op, agentErr.GetOperation())
}
