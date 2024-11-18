package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func GetCredentialsHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		cs, err := credentials.NewCredentialsService(log)
		if err != nil {
			if aerr, ok := err.(*types.AgentError); ok {
				if aerr.Code == types.ErrorCredentialServiceUnavailable {
					apiErr := types.APIErrorCredentialsUnavailableFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}
			}
			InternalError(w, req, log, err)
			return
		}

		creds, err := cs.List()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(creds)
	}
}
