package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/publishing-client/internal/services/api/deployments"
)

func GetDeploymentHandlerFunc(deploymentsService deployments.DeploymentsService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		d := deploymentsService.GetDeployment()
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(d)
	}
}
