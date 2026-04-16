package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"slices"
	"strings"

	"github.com/mitchellh/mapstructure"
)

type ErrorCode string
type ErrorData map[string]any
type Operation string

const (
	ErrorResourceNotFound             ErrorCode = "resourceNotFound"
	ErrorInvalidTOML                  ErrorCode = "invalidTOML"
	ErrorUnknownTOMLKey               ErrorCode = "unknownTOMLKey"
	ErrorCredentialServiceUnavailable ErrorCode = "credentialsServiceUnavailable"
	ErrorCredentialsCannotBackupFile  ErrorCode = "credentialsCannotBackupFile"
	ErrorUnknown                      ErrorCode = "unknown"
	ErrorTomlUnknownError             ErrorCode = "tomlUnknownError"
)

type AgentError struct {
	Code    ErrorCode `json:"code" toml:"code"`
	Err     error     `json:"-" toml:"-"`
	Message string    `json:"msg" toml:"message"`
	Op      Operation `json:"operation" toml:"operation"`
	Data    ErrorData `json:"data" toml:"data,omitempty"`
}

func normalizeAgentErrorMsg(errMsg string) string {
	spChars := []string{"?", "!", ")", "."}
	msg := strings.TrimSpace(errMsg)
	msg = strings.ToUpper(msg[:1]) + msg[1:]

	msgLastChar := msg[len(msg)-1:]
	if slices.Contains(spChars, msgLastChar) {
		return msg
	}

	return msg + "."
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
		msg = normalizeAgentErrorMsg(err.Error())
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

func (e *AgentError) Error() string {
	return e.Err.Error()
}
