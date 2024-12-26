package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
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

func ResetCredentialsHandlerFunc(log logging.Logger, credserviceFactory credentials.CredServiceFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		cs, err := credserviceFactory(log)
		if errIsNotLoadError(err) {
			unavailableCredsRes(w, err)
			return
		}

		err = cs.Reset()
		if err != nil {
			unavailableCredsRes(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
