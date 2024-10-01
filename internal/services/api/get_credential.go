package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func GetCredentialHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		guid := mux.Vars(req)["guid"]

		cs, err := credentials.NewCredentialsService(log)
		if err != nil {
			if aerr, ok := err.(*types.AgentError); ok {
				if aerr.Code == types.ErrorCredentialServiceUnavailable {
					apiErr := APIErrorCredentialsUnavailableFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}
			}
			InternalError(w, req, log, err)
			return
		}

		cred, err := cs.Get(guid)
		if err != nil {
			switch e := err.(type) {
			case *credentials.NotFoundError:
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(http.StatusText(http.StatusNotFound)))
				return
			default:
				InternalError(w, req, log, e)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(cred)
	}
}
