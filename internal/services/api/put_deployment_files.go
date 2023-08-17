package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type PutDeploymentFilesRequestBody struct {
	Files []string `json:"files"`
}

func PutDeploymentFilesHandlerFunc(deploymentsService deployments.IDeploymentsService, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		var b PutDeploymentFilesRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequestJson(w, r, log, err)
			return
		}

		d := deploymentsService.SetDeploymentFiles(b.Files)

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(d)
	}
}
