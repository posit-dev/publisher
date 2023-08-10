package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

func getDeployment(d *state.Deployment, w http.ResponseWriter) {
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(d)
}

func NewDeploymentController(ds *state.Deployment, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getDeployment(ds, w)
		default:
			api.MethodNotAllowed(w, r, log)
		}
	}
}
