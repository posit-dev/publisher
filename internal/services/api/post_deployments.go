package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PostDeploymentsRequestBody struct {
	AccountName string `json:"account"`
	SaveName    string `json:"saveName"`
}

func PostDeploymentsHandlerFunc(
	base util.Path,
	log logging.Logger,
	accountList accounts.AccountList) http.HandlerFunc {

	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostDeploymentsRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		acct, err := accountList.GetAccountByName(b.AccountName)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				NotFound(w, log, err)
				return
			} else {
				InternalError(w, req, log, err)
				return
			}
		}

		path := deployment.GetDeploymentPath(base, b.SaveName)
		exists, err := path.Exists()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		if exists {
			w.WriteHeader(http.StatusConflict)
			return
		}

		d := deployment.New()
		d.ServerURL = acct.URL
		d.ServerType = acct.ServerType

		err = d.WriteFile(path)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := &deploymentDTO{
			State:      stateFromDeployment(d),
			Name:       b.SaveName,
			Path:       path.String(),
			Deployment: d,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
