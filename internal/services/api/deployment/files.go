package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type selectedFilesInput struct {
	Files []string `json:"files"`
}

func NewSelectedFilesEndpoint(deploymentState *state.Deployment, logger rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if req.Method == "PUT" {
			var input selectedFilesInput
			decoder := json.NewDecoder(req.Body)
			decoder.DisallowUnknownFields()
			err := decoder.Decode(&input)
			if err != nil {
				api.BadRequestJson(w, req, logger, err)
				return
			}
			// Clear out existing files, then save the new ones.
			manifest := &deploymentState.Manifest
			manifest.Files = bundles.FileMap{}
			for _, file := range input.Files {
				// We'll save the file path, but leave reading the
				// file and calculating the hash until deployment time.
				manifest.Files[file] = bundles.ManifestFile{}
			}

			// Any side effects (e.g. re-inspecting content type
			// or dependencies) should be done here.
			// Then, return the changed portion of the state.
			// Initially returning the entire state, but we should
			// optimize this once we know the parts that may change.
			json.NewEncoder(w).Encode(deploymentState)
		} else {
			api.MethodNotAllowed(w, req, logger)
			return
		}
	}
}
