package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"net/http"

	"github.com/posit-dev/publisher/internal/types"
)

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
	Code    types.ErrorCode       `json:"code"`
	Details UnknownTOMLKeyDetails `json:"details"`
}

func APIErrorUnknownTOMLKeyFromAgentError(aerr types.AgentError) APIErrorUnknownTOMLKeyDetails {
	return APIErrorUnknownTOMLKeyDetails{
		Code: types.ErrorUnknownTOMLKey,
		Details: UnknownTOMLKeyDetails{
			Filename: aerr.Data["file"].(string),
			Key:      aerr.Data["key"].(string),
			Line:     aerr.Data["line"].(int),
			Column:   aerr.Data["column"].(int),
		},
	}
}

func (apierr *APIErrorUnknownTOMLKeyDetails) JSONResponse(w http.ResponseWriter) {
	JsonResult(w, http.StatusBadRequest, apierr)
}

type InvalidTOMLFileDetails struct {
	Filename string `json:"filename"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
}

type APIErrorInvalidTOMLFileDetails struct {
	Code    types.ErrorCode        `json:"code"`
	Details InvalidTOMLFileDetails `json:"details"`
}

func APIErrorInvalidTOMLFileFromAgentError(aerr types.AgentError) APIErrorInvalidTOMLFileDetails {
	return APIErrorInvalidTOMLFileDetails{
		Code: types.ErrorInvalidTOML,
		Details: InvalidTOMLFileDetails{
			Filename: aerr.Data["file"].(string),
			Line:     aerr.Data["line"].(int),
			Column:   aerr.Data["column"].(int),
		},
	}
}

func (apierr *APIErrorInvalidTOMLFileDetails) JSONResponse(w http.ResponseWriter) {
	JsonResult(w, http.StatusBadRequest, apierr)
}

type APIErrorCredentialServiceUnavailable struct {
	Code types.ErrorCode `json:"code"`
}

func APIErrorCredentialsUnavailableFromAgentError(aerr types.AgentError) APIErrorCredentialServiceUnavailable {
	return APIErrorCredentialServiceUnavailable{
		Code: types.ErrorCredentialServiceUnavailable,
	}
}

func (apierr *APIErrorCredentialServiceUnavailable) JSONResponse(w http.ResponseWriter) {
	JsonResult(w, http.StatusServiceUnavailable, apierr)
}
