package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PatchDeploymentRequestBody struct {
	ConfigName string          `json:"configurationName"`
	ID         types.ContentID `json:"id"`
}

func PatchDeploymentHandlerFunc(
	base util.AbsolutePath,
	log logging.Logger) http.HandlerFunc {

	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PatchDeploymentRequestBody
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		// Deployment must exist
		path := deployment.GetDeploymentPath(projectDir, name)
		exists, err := path.Exists()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		if !exists {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		d, err := deployment.FromFile(path)
		if err != nil {
			w.WriteHeader(http.StatusUnprocessableEntity)
			w.Write([]byte(fmt.Sprintf("failed to load deployment %s", name)))
			return
		}

		if b.ConfigName != "" {

			// Config must exist
			configPath := config.GetConfigPath(projectDir, b.ConfigName)
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

			d.ConfigName = b.ConfigName
		}
		if b.ID != "" {
			// no validation for GUID at this time.
			d.ID = b.ID

			// Update the URLs since we have the GUID
			d.DashboardURL = util.GetDashboardURL(d.ServerURL, b.ID)
			d.LogsURL = util.GetLogsURL(d.ServerURL, b.ID)
			d.DirectURL = util.GetDirectURL(d.ServerURL, b.ID)
		}

		// Not operating within a deployment thread, so we'll use an empty string
		// for the localIdIfDeploying
		latest, err := d.WriteFile(path, "", log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := deploymentAsDTO(latest, err, projectDir, relProjectDir, path)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
