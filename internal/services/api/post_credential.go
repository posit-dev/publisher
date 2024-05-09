package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/credentials"
	"github.com/rstudio/connect-client/internal/logging"
)

func PostCredentialFuncHandler(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {

		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var cred credentials.Credential
		err := dec.Decode(&cred)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		cs := credentials.CredentialsService{}
		err = cs.Set(cred)
		if err != nil {
			if _, ok := err.(*credentials.URLCollisionError); ok {
				http.Error(w, http.StatusText(http.StatusConflict), http.StatusConflict)
				return
			}
			InternalError(w, req, log, err)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}
}
