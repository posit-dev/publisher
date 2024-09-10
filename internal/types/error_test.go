package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	agentErr := OperationError(Operation("testOp"), err)
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
	s.Equal("an error occurred", agentErr.Error())
	s.Equal(agentErr.GetCode(), code)
	s.Equal(ErrorData{
		"Metadata": "Some metadata",
	}, agentErr.GetData())
	s.Equal(op, agentErr.GetOperation())
}

func (s *ErrorSuite) TestAsAgentError() {
	s.Nil(AsAgentError(nil))

	err := errors.New("an error occurred")
	s.Equal(err, AsAgentError(err).Err)

	agentErr := OperationError(Operation("testOp"), err)
	s.Equal(agentErr, AsAgentError(agentErr))
}

func (s *ErrorSuite) TestNewAgentError() {
	originalError := errors.New("shattered glass!")
	aerr := NewAgentError(ErrorInvalidTOML, originalError, nil)
	s.Equal(aerr, &AgentError{
		Message: "Configuration file is not in a valid TOML format: shattered glass!",
		Code:    ErrorInvalidTOML,
		Status:  http.StatusBadRequest,
		Err:     originalError,
		Data:    make(ErrorData),
	})
}

func (s *ErrorSuite) TestNewAgentError_WithoutErr() {
	// Without an error (only error code), simpler message
	aerr := NewAgentError(ErrorInvalidTOML, nil, nil)
	s.Equal(aerr, &AgentError{
		Message: "Configuration file is not in a valid TOML format",
		Code:    ErrorInvalidTOML,
		Status:  http.StatusBadRequest,
		Err:     nil,
		Data:    make(ErrorData),
	})
}
