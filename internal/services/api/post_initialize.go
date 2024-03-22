package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PostInitializeRequestBody struct {
	ConfigName string `json:"configurationName"`
}

func PostInitializeHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostInitializeRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		if b.ConfigName == "" {
			b.ConfigName = config.DefaultConfigName
		}
		configPath := config.GetConfigPath(base, b.ConfigName)
		exists, err := configPath.Exists()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		if exists {
			w.WriteHeader(http.StatusConflict)
			return
		}
		cfg, err := initialize.Init(base, b.ConfigName, util.Path{}, log)
		if err != nil {
			cfg = config.New()
		}
		response := configDTO{
			Name:          b.ConfigName,
			Path:          configPath.String(),
			Configuration: cfg,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
