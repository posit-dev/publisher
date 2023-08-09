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

type body struct {
	Files []string `json:"files"`
}

func put(d *state.Deployment, log rslog.Logger, w http.ResponseWriter, r *http.Request) {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var b body
	err := dec.Decode(&b)
	if err != nil {
		api.BadRequestJson(w, r, log, err)
		return
	}

	// Clear out existing files, then save the new ones.
	mfm := bundles.NewManifestFileMap()
	for _, file := range b.Files {
		// We'll save the file path, but leave reading the
		// file and calculating the hash until deployment time.
		mfm[file] = bundles.NewManifestFile()
	}

	// mutate the Manifest Files value
	d.Manifest.Files = mfm

	// Any side effects (e.g. re-inspecting content type
	// or dependencies) should be done here.
	// Then, return the changed portion of the state.
	// Initially returning the entire state, but we should
	// optimize this once we know the parts that may change.
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(d)

}

func NewFilesController(ds *state.Deployment, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			put(ds, log, w, r)
		default:
			api.MethodNotAllowed(w, r, log)
		}
	}
}
