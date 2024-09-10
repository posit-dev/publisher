package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

type ErrorCode string
type ErrorData map[string]any
type Operation string

const (
	ErrorResourceNotFound   ErrorCode = "resourceNotFound"
	ErrorInvalidTOML        ErrorCode = "invalidTOML"
	ErrorUnknownTOMLKey     ErrorCode = "unknownTOMLKey"
	ErrorInvalidConfigFiles ErrorCode = "invalidConfigFiles"
	ErrorUnknownException   ErrorCode = "unknown"
)

var defaultUnknownErrMsg = "An unknown error occurred"

var errorMessageCatalog = map[ErrorCode]struct {
	Code    int
	Message string
}{
	ErrorResourceNotFound:   {http.StatusNotFound, "Requested resource not found"},
	ErrorInvalidTOML:        {http.StatusBadRequest, "Configuration file is not in a valid TOML format"},
	ErrorUnknownTOMLKey:     {http.StatusBadRequest, "Unknown field present in configuration file"},
	ErrorInvalidConfigFiles: {http.StatusUnprocessableEntity, "Invalid pattern in configuration files"},

	ErrorUnknownException: {http.StatusInternalServerError, defaultUnknownErrMsg},
}

type EventableError interface {
	error
	SetOperation(op Operation) // Caller who receives an error calls SetOperation to attach context
	GetOperation() Operation   // Retrieve Operation for serialization
	GetCode() ErrorCode        // Retrieve Code for serialization
	GetData() ErrorData        // Retrieve Data for serialization
}

type AgentError struct {
	Code    ErrorCode `json:"code" toml:"code"`
	Status  int       `json:"status" toml:"status"`
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
	return NewAgentError(ErrorUnknownException, e, nil)
}

func NewAgentError(code ErrorCode, err error, details any) *AgentError {
	data := make(ErrorData)
	msg := ""
	httpStatus := 0
	if errorEntry, ok := errorMessageCatalog[code]; ok {
		msg = errorEntry.Message
		httpStatus = errorEntry.Code
	}

	if err != nil {
		if msg != "" {
			msg = fmt.Sprintf("%s: %s", msg, err.Error())
		} else {
			msg = err.Error()
		}
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
		Status:  httpStatus,
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
		e = NewAgentError(ErrorUnknownException, err, nil)
	}
	e.SetOperation(op)
	return e
}
