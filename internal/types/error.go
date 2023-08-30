package types

// Copyright (C) 2023 by Posit Software, PBC.

import "github.com/mitchellh/mapstructure"

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
	Code ErrorCode `json:"-"`
	Err  error
	Data ErrorData
	Op   Operation `json:"-"`
}

const UnknownErrorCode ErrorCode = "unknown"

func NewAgentError(code ErrorCode, err error, details any) *AgentError {
	data := make(ErrorData)
	if err != nil {
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
		Code: code,
		Err:  err,
		Data: data,
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

func ErrToAgentError(op Operation, err error) EventableError {
	e, ok := err.(EventableError)
	if !ok {
		e = NewAgentError(UnknownErrorCode, err, nil)
	}
	e.SetOperation(op)
	return e
}
