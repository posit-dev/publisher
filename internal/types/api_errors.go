package types

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
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
