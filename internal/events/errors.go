package events

import (
	"fmt"
	"time"

	"github.com/mitchellh/mapstructure"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ErrorCode string

type EventableError interface {
	error
	SetOperation(op Operation)
	GetOperation() Operation
	ToEvent() AgentEvent
}

type AgentError struct {
	Code ErrorCode `json:"-"`
	Err  error
	Data EventData
	Op   Operation `json:"-"`
}

func NewAgentError(code ErrorCode, err error, details any) *AgentError {
	var data EventData
	mapstructure.Decode(err, &data)
	if details != nil {
		mapstructure.Decode(details, &data)
	}
	data["Msg"] = err.Error()

	return &AgentError{
		Code: code,
		Err:  err,
		Data: data,
	}
}

// Assert that AgentError satisfies the interface
var _ EventableError = &AgentError{}

func (e *AgentError) ToEvent() AgentEvent {
	return AgentEvent{
		Time: time.Now().UTC(),
		Type: fmt.Sprintf("%s/failure/%s", e.Op, e.Code),
		Data: e.Data,
	}
}

func (e *AgentError) SetOperation(op Operation) {
	e.Op = op
}

func (e *AgentError) GetOperation() Operation {
	return e.Op
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
