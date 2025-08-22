package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"reflect"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type DeleteIntegrationRequestRequest struct {
	Guid            string         `json:"guid,omitempty"`
	Name            string         `json:"name,omitempty"`
	Description     string         `json:"description,omitempty"`
	AuthType        string         `json:"auth_type,omitempty"`
	IntegrationType string         `json:"type,omitempty"`
	Config          map[string]any `json:"config,omitempty"`
}

func DeleteIntegrationRequestFuncHandler(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			return
		}
		configPath := config.GetConfigPath(projectDir, name)
		cfg, err := config.FromFile(configPath)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var body DeleteIntegrationRequestRequest
		err = dec.Decode(&body)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// create a target integration request from the request body
		targetIR := config.IntegrationRequest{
			Guid:            body.Guid,
			Name:            body.Name,
			Description:     body.Description,
			AuthType:        body.AuthType,
			IntegrationType: body.IntegrationType,
			Config:          body.Config,
		}

		found := false
		for i, ir := range cfg.IntegrationRequests {
			if reflect.DeepEqual(ir, targetIR) {
				cfg.IntegrationRequests = append(cfg.IntegrationRequests[:i], cfg.IntegrationRequests[i+1:]...)
				found = true
				break
			}
		}

		if !found {
			http.NotFound(w, req)
			return
		}

		// Save the updated configuration
		err = cfg.WriteFile(configPath)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		relPath, err := configPath.Rel(base)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		response := &configDTO{
			configLocation: configLocation{
				Name:    name,
				Path:    configPath.String(),
				RelPath: relPath.String(),
			},
			ProjectDir:    relProjectDir.String(),
			Configuration: cfg,
		}

		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
