package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/mitchellh/mapstructure"
)

type ErrorCode string
type ErrorData map[string]any
type Operation string

type EventableError interface {
	error
	SetOperation(op Operation) // Caller who receives an error calls SetOperation to attach context
	GetOperation() Operation   // Retrieve Operation for serialization
	GetCode() ErrorCode        // Retrieve Code for serialization
	GetData() ErrorData        // Retrieve Data for serialization
}

type AgentError struct {
	Code    ErrorCode `json:"code"`
	Err     error     `json:"-"`
	Message string    `json:"msg"`
	Data    ErrorData `json:"data"`
	Op      Operation `json:"-"`
}

const UnknownErrorCode ErrorCode = "unknown"

func AsAgentError(e error) *AgentError {
	if e == nil {
		return nil
	}
	agentErr, ok := e.(*AgentError)
	if ok {
		return agentErr
	}
	return NewAgentError(UnknownErrorCode, e, nil)
}

func NewAgentError(code ErrorCode, err error, details any) *AgentError {
	data := make(ErrorData)
	msg := ""
	if err != nil {
		msg = err.Error()
		mapstructure.Decode(err, &data)
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
		e = NewAgentError(UnknownErrorCode, err, nil)
	}
	e.SetOperation(op)
	return e
}
