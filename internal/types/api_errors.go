package types

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func jsonResult(w http.ResponseWriter, status int, result any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(result)
}

type APIError interface {
	JSONResponse(http.ResponseWriter)
}

type UnknownTOMLKeyDetails struct {
	Filename string `json:"filename"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Key      string `json:"key"`
}

type APIErrorUnknownTOMLKeyDetails struct {
	Code    ErrorCode             `json:"code"`
	Details UnknownTOMLKeyDetails `json:"details"`
}

func APIErrorUnknownTOMLKeyFromAgentError(aerr AgentError) APIErrorUnknownTOMLKeyDetails {
	return APIErrorUnknownTOMLKeyDetails{
		Code: ErrorUnknownTOMLKey,
		Details: UnknownTOMLKeyDetails{
			Filename: aerr.Data["file"].(string),
			Key:      aerr.Data["key"].(string),
			Line:     aerr.Data["line"].(int),
			Column:   aerr.Data["column"].(int),
		},
	}
}

func (apierr *APIErrorUnknownTOMLKeyDetails) Error() string {
	return fmt.Sprintf("Error: ErrorUnknownTOMLKey, Filename: %s, Key: %s, Line: %d, Column: %d",
		apierr.Details.Filename, apierr.Details.Key, apierr.Details.Line, apierr.Details.Column)
}

func (apierr *APIErrorUnknownTOMLKeyDetails) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusBadRequest, apierr)
}

type InvalidTOMLFileDetails struct {
	Filename string `json:"filename"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
}

type APIErrorInvalidTOMLFileDetails struct {
	Code    ErrorCode              `json:"code"`
	Details InvalidTOMLFileDetails `json:"details"`
}

func (apierr *APIErrorInvalidTOMLFileDetails) Error() string {
	return fmt.Sprintf("Error: ErrorInvalidTOML, Filename: %s, Line: %d, Column: %d",
		apierr.Details.Filename, apierr.Details.Line, apierr.Details.Column)
}

func (apierr *APIErrorInvalidTOMLFileDetails) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusBadRequest, apierr)
}

func APIErrorInvalidTOMLFileFromAgentError(aerr AgentError) APIErrorInvalidTOMLFileDetails {
	return APIErrorInvalidTOMLFileDetails{
		Code: ErrorInvalidTOML,
		Details: InvalidTOMLFileDetails{
			Filename: aerr.Data["file"].(string),
			Line:     aerr.Data["line"].(int),
			Column:   aerr.Data["column"].(int),
		},
	}
}

// ErrorTomlValidationError
type ErrorTomlValidationDetails struct {
	Filename        string `json:"filename"`
	Message         string `json:"message"`
	Key             string `json:"key"`
	Problem         string `json:"problem"`
	SchemaReference string `json:"schema-reference"`
}

type APIErrorTomlValidationDetails struct {
	Code    ErrorCode                  `json:"code"`
	Details ErrorTomlValidationDetails `json:"details"`
}

func (apierr *APIErrorTomlValidationDetails) Error() string {
	return fmt.Sprintf("Error: ErrorTomlValidationError, Filename: %s, Message: %s, Key: %s, Problem: %s, SchemaReference: %s",
		apierr.Details.Filename, apierr.Details.Message, apierr.Details.Key, apierr.Details.Problem, apierr.Details.SchemaReference)
}

func (apierr *APIErrorTomlValidationDetails) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusBadRequest, apierr)
}

func APIErrorTomlValidationFromAgentError(aerr AgentError, configPath string) APIErrorTomlValidationDetails {
	return APIErrorTomlValidationDetails{
		Code: ErrorTomlValidationError,
		Details: ErrorTomlValidationDetails{
			Filename:        configPath,
			Message:         aerr.Err.Error(),
			Key:             aerr.Data["key"].(string),
			Problem:         aerr.Data["problem"].(string),
			SchemaReference: aerr.Data["schema-reference"].(string),
		},
	}
}

// ErrorTomlUnknownError
type ErrorTomlUnknownErrorDetails struct {
	Filename string `json:"filename"`
	Problem  string `json:"problem"`
}

type APIErrorTomlUnknownErrorDetails struct {
	Code    ErrorCode                    `json:"code"`
	Details ErrorTomlUnknownErrorDetails `json:"details"`
}

func (apierr *APIErrorTomlUnknownErrorDetails) Error() string {
	return fmt.Sprintf("Error: ErrorTomlUnknownError, Filename: %s, Problem: %s",
		apierr.Details.Filename, apierr.Details.Problem)
}

func (apierr *APIErrorTomlUnknownErrorDetails) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusBadRequest, apierr)
}

func APIErrorTomlUnknownErrorFromAgentError(aerr AgentError, configPath string) APIErrorTomlUnknownErrorDetails {
	return APIErrorTomlUnknownErrorDetails{
		Code: ErrorTomlUnknownError,
		Details: ErrorTomlUnknownErrorDetails{
			Filename: configPath,
			Problem:  aerr.Err.Error(),
		},
	}
}

type APIErrorCredentialServiceUnavailable struct {
	Code ErrorCode `json:"code"`
}

func (apierr *APIErrorCredentialServiceUnavailable) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusServiceUnavailable, apierr)
}

func APIErrorCredentialsUnavailableFromAgentError(aerr AgentError) APIErrorCredentialServiceUnavailable {
	return APIErrorCredentialServiceUnavailable{
		Code: ErrorCredentialServiceUnavailable,
	}
}

type APIErrorCredentialsCorrupted struct {
	Code ErrorCode `json:"code"`
}

func (apierr *APIErrorCredentialsCorrupted) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusConflict, apierr)
}

func APIErrorCredentialsCorruptedFromAgentError(aerr AgentError) APIErrorCredentialsCorrupted {
	return APIErrorCredentialsCorrupted{
		Code: ErrorCredentialsCorrupted,
	}
}

type APIErrorPythonExecNotFound struct {
	Code ErrorCode `json:"code"`
}

func APIErrorPythonExecNotFoundFromAgentError(aerr AgentError) APIErrorPythonExecNotFound {
	return APIErrorPythonExecNotFound{
		Code: ErrorPythonExecNotFound,
	}
}

func (apierr *APIErrorPythonExecNotFound) JSONResponse(w http.ResponseWriter) {
	jsonResult(w, http.StatusUnprocessableEntity, apierr)
}
