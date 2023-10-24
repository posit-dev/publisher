package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
)

type PutDeploymentAccountRequestBody struct {
	// TBD...
	Account string `json:"account"`
}

func PutDeploymentAccountHandlerFunc(lister accounts.AccountList, deploymentsService deployments.DeploymentsService, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		var b PutDeploymentAccountRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequestJson(w, r, log, err)
			return
		}

		d, err := deploymentsService.SetDeploymentAccount(lister, b.Account)
		if err != nil {
			BadRequestJson(w, r, log, err)
			return
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(d)
	}
}
