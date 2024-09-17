package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
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
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(apierr)
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
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(apierr)
}
