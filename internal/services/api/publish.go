package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
)

type PublishReponse struct {
	LocalID state.LocalDeploymentID `json:"local_id"` // Unique ID of this publishing operation. Only valid for this run of the agent.
}

func PostPublishHandlerFunc(publishArgs *cli_types.PublishArgs, lister accounts.AccountList, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		localID, err := state.NewLocalID()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		publishArgs.State.LocalID = localID
		response := PublishReponse{
			LocalID: localID,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(response)

		go func() {
			log = log.WithArgs("local_id", localID)
			err := publish.PublishManifestFiles(publishArgs, lister, log)
			if err != nil {
				log.Error("Deployment failed", "error", err.Error())
			}
		}()
	}
}
