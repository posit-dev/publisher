package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/types"
)

type credentialServiceUnavailableError struct {
	Code types.ErrorCode `json:"code"`
}

func (e *credentialServiceUnavailableError) JSONResponse(w http.ResponseWriter) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusServiceUnavailable)
	json.NewEncoder(w).Encode(e)
}

func credentialsUnavailableResponse(aerr types.AgentError) credentialServiceUnavailableError {
	return credentialServiceUnavailableError{
		Code: types.ErrorCredentialServiceUnavailable,
	}
}

type credentialsBackupFileError struct {
	Code    types.ErrorCode                `json:"code"`
	Details credentialsBackupFileDetails `json:"details"`
}

type credentialsBackupFileDetails struct {
	Filename string `json:"filename"`
	Message  string `json:"message"`
}

func (e *credentialsBackupFileError) JSONResponse(w http.ResponseWriter) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(e)
}

func credentialsBackupFileResponse(aerr types.AgentError) credentialsBackupFileError {
	return credentialsBackupFileError{
		Code: types.ErrorCredentialsCannotBackupFile,
		Details: credentialsBackupFileDetails{
			Filename: aerr.Data["Filename"].(string),
			Message:  aerr.Data["Message"].(string),
		},
	}
}
