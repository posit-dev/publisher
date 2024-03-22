package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

func GetDeploymentHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		path := deployment.GetDeploymentPath(base, name)
		d, err := deployment.FromFile(path)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		response := deploymentAsDTO(d, err, base, path)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
