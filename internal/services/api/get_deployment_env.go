package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func GetDeploymentEnvironmentHandlerFunc(base util.AbsolutePath, log logging.Logger, accountList accounts.AccountList) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}

		path := deployment.GetDeploymentPath(projectDir, name)
		d, err := deployment.FromFile(path)
		if err != nil {
			// If the deployment file doesn't exist, return a 404
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
				return
			}
			// If the deployment file is in error return a 400
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("deployment %s is invalid: %s", name, err)))
			return
		}

		if !d.IsDeployed() {
			// If the deployment file is not deployed, it cannot have
			// environment variables on the server so return a 400
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("deployment %s is not deployed", name)))
			return
		}

		account, err := accountList.GetAccountByServerURL(d.ServerURL)
		if err != nil {
			// If the deployment server URL doesn't have an associated
			// credential return a 400
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("no credential found to use with deployment %s", name)))
			return
		}

		client, err := connectClientFactory(account, 30*time.Second, events.NewNullEmitter(), log)
		if err != nil {
			// If the client cannot be created, we did something wrong,
			// return a 500
			InternalError(w, req, log, err)
			return
		}
		env, err := client.GetEnvVars(d.ID, log)
		// TODO content on the server could be deleted
		if err != nil {
			httpErr, ok := err.(*http_client.HTTPError)
			if ok {
				// Pass through HTTP Error from Connect
				w.WriteHeader(httpErr.Status)
				w.Write([]byte(httpErr.Error()))
				return
			}
			// If we get anything other than a HTTP Error from Connect client,
			// return a 500
			InternalError(w, req, log, err)
			return
		}

		JsonResult(w, http.StatusOK, env)
	}
}
