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

func (s *ErrorSuite) TestUsage() {
	code := ErrorCode("BadError")
	err := errors.New("an error occurred")
	details := struct {
		Metadata string
	}{"Some metadata"}
	agentErr := NewAgentError(code, err, &details)

	s.Equal("an error occurred", agentErr.Error())
	s.Equal(code, agentErr.Code)
	s.Equal(ErrorData{
		"Metadata": "Some metadata",
	}, agentErr.Data)
}

func (s *ErrorSuite) TestAsAgentError() {
	s.Nil(AsAgentError(nil))

	err := errors.New("an error occurred")
	s.Equal(err, AsAgentError(err).Err)

	agentErr := NewAgentError(ErrorUnknown, err, nil)
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

func (s *ErrorSuite) TestNewAgentError_MessagePunctuation() {
	// Sentence case, period ending, space trimming
	originalError := errors.New("  oh sorry, my mistake  ")
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

