package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PostDeploymentsRequestBody struct {
	AccountName string `json:"account"`
	ConfigName  string `json:"config"`
	SaveName    string `json:"saveName"`
}

func PostDeploymentsHandlerFunc(
	base util.AbsolutePath,
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
		err = util.ValidateFilename(b.SaveName)
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

		// Deployment must not exist
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

		if b.ConfigName != "" {
			// Config must exist
			configPath := config.GetConfigPath(base, b.ConfigName)
			exists, err = configPath.Exists()
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
			if !exists {
				w.WriteHeader(http.StatusUnprocessableEntity)
				w.Write([]byte(fmt.Sprintf("configuration %s not found", b.ConfigName)))
				return
			}
		}

		d := deployment.New()
		d.ServerURL = acct.URL
		d.ServerType = acct.ServerType
		d.ConfigName = b.ConfigName

		err = d.WriteFile(path)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := deploymentAsDTO(d, err, base, path)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
