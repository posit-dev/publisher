package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/mitchellh/mapstructure"
)

type ErrorCode string
type ErrorData map[string]any
type Operation string

const (
	ErrorResourceNotFound             ErrorCode = "resourceNotFound"
	ErrorInvalidTOML                  ErrorCode = "invalidTOML"
	ErrorUnknownTOMLKey               ErrorCode = "unknownTOMLKey"
	ErrorInvalidConfigFiles           ErrorCode = "invalidConfigFiles"
	ErrorCredentialServiceUnavailable ErrorCode = "credentialsServiceUnavailable"
	ErrorCertificateVerification      ErrorCode = "errorCertificateVerification"
	ErrorRenvLockPackagesReading      ErrorCode = "renvlockPackagesReadingError"
	ErrorUnknown                      ErrorCode = "unknown"
)

type EventableError interface {
	error
	SetOperation(op Operation) // Caller who receives an error calls SetOperation to attach context
	GetOperation() Operation   // Retrieve Operation for serialization
	GetCode() ErrorCode        // Retrieve Code for serialization
	GetData() ErrorData        // Retrieve Data for serialization
}

type AgentError struct {
	Code    ErrorCode `json:"code" toml:"code"`
	Err     error     `json:"-" toml:"-"`
	Message string    `json:"msg" toml:"message"`
	Op      Operation `json:"operation" toml:"operation"`
	Data    ErrorData `json:"data" toml:"data,omitempty"`
}

func AsAgentError(e error) *AgentError {
	if e == nil {
		return nil
	}
	agentErr, ok := e.(*AgentError)
	if ok {
		return agentErr
	}
	return NewAgentError(ErrorUnknown, e, nil)
}

func NewAgentError(code ErrorCode, err error, details any) *AgentError {
	data := make(ErrorData)
	msg := ""

	if err != nil {
		msg = err.Error()
	}
	if details != nil {
		detailMap := make(ErrorData)
		mapstructure.Decode(details, &detailMap)
		for k, v := range detailMap {
			data[k] = v
		}
	}
	return &AgentError{
		Message: msg,
		Code:    code,
		Err:     err,
		Data:    data,
	}
}

// Assert that AgentError satisfies the interface
var _ EventableError = &AgentError{}

func (e *AgentError) SetOperation(op Operation) {
	e.Op = op
}

func (e *AgentError) GetOperation() Operation {
	return e.Op
}

func (e *AgentError) GetCode() ErrorCode {
	return e.Code
}

func (e *AgentError) GetData() ErrorData {
	return e.Data
}

func (e *AgentError) Error() string {
	return e.Err.Error()
}

func OperationError(op Operation, err error) EventableError {
	e, ok := err.(EventableError)
	if !ok {
		e = NewAgentError(ErrorUnknown, err, nil)
	}
	e.SetOperation(op)
	return e
}

// Evaluate if a given error is an AgentError
// returning the error as AgentError type when it is
// and a bool flag of the comparison result.
func IsAgentError(err error) (*AgentError, bool) {
	if aerr, ok := err.(*AgentError); ok {
		return aerr, ok
	}
	return nil, false
}
