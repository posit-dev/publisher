package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/connect-client/internal/credentials"
	"github.com/rstudio/connect-client/internal/logging"
)

func DeleteCredentialHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		cs := credentials.CredentialsService{}

		params := req.URL.Query()
		name := params.Get("name")

		if name == "" {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		err := cs.Delete(name)
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
