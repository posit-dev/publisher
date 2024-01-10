package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PostDeploymentsRequestBody struct {
	AccountName string `json:"account"`
	ConfigName  string `json:"config"` // optional
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

		configRelPath := util.Path{}
		if b.ConfigName != "" {
			configPath := config.GetConfigPath(base, b.ConfigName)
			_, err := config.FromFile(configPath)
			if err != nil {
				if errors.Is(err, fs.ErrNotExist) {
					NotFound(w, log, err)
					return
				} else {
					InternalError(w, req, log, err)
					return
				}
			}
			configRelPath, err = configPath.Rel(base)
			if err != nil {
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
		d.ConfigName = b.ConfigName
		d.ServerURL = acct.URL
		d.ServerType = acct.ServerType

		err = d.WriteFile(path)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := &deploymentDTO{
			Name:       b.SaveName,
			Path:       path.String(),
			ConfigPath: configRelPath.String(),
			Deployment: d,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
