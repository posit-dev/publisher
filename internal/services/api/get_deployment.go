package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

func readLatestDeploymentFile(base util.Path, id string) (*deployment.Deployment, error) {
	path := deployment.GetLatestDeploymentPath(base, id)
	return deployment.FromFile(path)
}

func GetDeploymentHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]
		response, err := readLatestDeploymentFile(base, id)
		if err != nil {
			InternalError(w, req, log, err)
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
