package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func DeleteCredentialHandlerFunc(log logging.Logger) http.HandlerFunc {
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

		err = cs.Delete(guid)
		if err != nil {
			switch e := err.(type) {
			case *credentials.NotFoundError:
				NotFound(w, log, e)
			default:
				InternalError(w, req, log, e)
				return
			}
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
