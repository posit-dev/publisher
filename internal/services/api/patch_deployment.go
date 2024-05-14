package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PatchDeploymentRequestBody struct {
	ConfigName string `json:"configurationName"`
}

func PatchDeploymentHandlerFunc(
	base util.AbsolutePath,
	log logging.Logger) http.HandlerFunc {

	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PatchDeploymentRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		// Deployment must exist
		path := deployment.GetDeploymentPath(base, name)
		exists, err := path.Exists()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		if !exists {
			w.WriteHeader(http.StatusNotFound)
			return
		}

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

		d, err := deployment.FromFile(path)
		if err != nil {
			w.WriteHeader(http.StatusUnprocessableEntity)
			w.Write([]byte(fmt.Sprintf("failed to load deployment %s", name)))
			return
		}

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
