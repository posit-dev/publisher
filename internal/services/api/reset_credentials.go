package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

// We can ignore errors related to malformed data, we are resetting it ain't we?
func errIsNotLoadError(err error) bool {
	return err != nil && !errors.Is(err, &credentials.LoadError{}) && !errors.Is(err, &credentials.CorruptedError{})
}

func unavailableCredsRes(w http.ResponseWriter, err error) {
	agentErr := types.AsAgentError(err)
	apiErr := types.APIErrorCredentialsUnavailableFromAgentError(*agentErr)
	apiErr.JSONResponse(w)
}

func cannotBackupFileRes(w http.ResponseWriter, err error) {
	agentErr := types.AsAgentError(err)
	apiErr := types.APIErrorCredentialsBackupFileFromAgentError(*agentErr)
	apiErr.JSONResponse(w)
}

func ResetCredentialsHandlerFunc(log logging.Logger, credserviceFactory credentials.CredServiceFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		result := struct {
			BackupFile string `json:"backupFile"`
		}{}

		cs, err := credserviceFactory(log)
		if errIsNotLoadError(err) {
			unavailableCredsRes(w, err)
			return
		}

		backupFile, err := cs.Reset()
		if err != nil {
			var agentErr *types.AgentError
			if errors.As(err, &agentErr) && agentErr.Code == types.ErrorCredentialsCannotBackupFile {
				cannotBackupFileRes(w, err)
				return
			}
			unavailableCredsRes(w, err)
			return
		}

		if backupFile != "" {
			result.BackupFile = backupFile
		}

		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}
