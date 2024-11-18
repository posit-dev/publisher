package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
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
		Message: "Shattered glass!",
		Code:    ErrorInvalidTOML,
		Err:     originalError,
		Data:    make(ErrorData),
	})
}

func (s *ErrorSuite) TestIsAgentError() {
	originalError := errors.New("shattered glass!")
	aerr, isIt := IsAgentError(originalError)
	s.Equal(isIt, false)
	s.Nil(aerr)

	aTrueAgentError := NewAgentError(ErrorInvalidTOML, originalError, nil)
	aerr, isIt = IsAgentError(aTrueAgentError)
	s.Equal(isIt, true)
	s.Equal(aerr, &AgentError{
		Message: "Shattered glass!",
		Code:    ErrorInvalidTOML,
		Err:     originalError,
		Data:    make(ErrorData),
	})
}

func (s *ErrorSuite) TestNewAgentError_MessagePunctuation() {
	// Sentence case and period ending
	originalError := errors.New("oh sorry, my mistake")
	aerr := NewAgentError(ErrorResourceNotFound, originalError, nil)
	s.Equal(aerr, &AgentError{
		Message: "Oh sorry, my mistake.",
		Code:    ErrorResourceNotFound,
		Err:     originalError,
		Data:    make(ErrorData),
	})

	// No need for period ending when shouting "!"
	originalError = errors.New("i can't believe is October already!")
	aerr = NewAgentError(ErrorResourceNotFound, originalError, nil)
	s.Equal(aerr, &AgentError{
		Message: "I can't believe is October already!",
		Code:    ErrorResourceNotFound,
		Err:     originalError,
		Data:    make(ErrorData),
	})

	// No need for period ending when asking "?"
	originalError = errors.New("can you believe 2024 is almos over?")
	aerr = NewAgentError(ErrorResourceNotFound, originalError, nil)
	s.Equal(aerr, &AgentError{
		Message: "Can you believe 2024 is almos over?",
		Code:    ErrorResourceNotFound,
		Err:     originalError,
		Data:    make(ErrorData),
	})

	// No need for period ending when ending parentheses ")"
	originalError = errors.New("wrong credentials (is this one of those bad typing days?)")
	aerr = NewAgentError(ErrorResourceNotFound, originalError, nil)
	s.Equal(aerr, &AgentError{
		Message: "Wrong credentials (is this one of those bad typing days?)",
		Code:    ErrorResourceNotFound,
		Err:     originalError,
		Data:    make(ErrorData),
	})
}

func (s *ErrorSuite) TestIsAgentErrorOf() {
	originalError := errors.New("shattered glass!")
	aerr, isIt := IsAgentErrorOf(originalError, ErrorInvalidConfigFiles)
	s.Equal(isIt, false)
	s.Nil(aerr)

	aTrueAgentError := NewAgentError(ErrorInvalidTOML, originalError, nil)
	aerr, isIt = IsAgentErrorOf(aTrueAgentError, ErrorInvalidConfigFiles)
	s.Equal(isIt, false)
	s.Equal(aerr, &AgentError{
		Message: "Shattered glass!",
		Code:    ErrorInvalidTOML,
		Err:     originalError,
		Data:    make(ErrorData),
	})

	aTrueAgentError = NewAgentError(ErrorInvalidConfigFiles, originalError, nil)
	aerr, isIt = IsAgentErrorOf(aTrueAgentError, ErrorInvalidConfigFiles)
	s.Equal(isIt, true)
	s.Equal(aerr, &AgentError{
		Message: "Shattered glass!",
		Code:    ErrorInvalidConfigFiles,
		Err:     originalError,
		Data:    make(ErrorData),
	})
}
