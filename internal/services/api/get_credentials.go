package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func handleCredServiceError(w http.ResponseWriter, err error) {
	agentErr := types.AsAgentError(err)
	if errors.Is(err, &credentials.LoadError{}) || errors.Is(err, &credentials.CorruptedError{}) {
		apiErr := types.APIErrorCredentialsCorruptedFromAgentError(*agentErr)
		apiErr.JSONResponse(w)
		return
	}
	apiErr := types.APIErrorCredentialsUnavailableFromAgentError(*agentErr)
	apiErr.JSONResponse(w)
}

func GetCredentialsHandlerFunc(log logging.Logger, credserviceFactory credentials.CredServiceFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		cs, err := credserviceFactory(log)
		if err != nil {
			handleCredServiceError(w, err)
			return
		}

		creds, err := cs.List()
		if err != nil {
			handleCredServiceError(w, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(creds)
	}
}
