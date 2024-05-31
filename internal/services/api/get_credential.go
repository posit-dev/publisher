package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
)

func GetCredentialHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		guid := mux.Vars(req)["guid"]
		cs := credentials.CredentialsService{}
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
