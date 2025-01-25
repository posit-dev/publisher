package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PostDeploymentRequestBody struct {
	AccountName string            `json:"account"`
	ConfigName  string            `json:"config"`
	Secrets     map[string]string `json:"secrets,omitempty"`
	Insecure    bool              `json:"insecure"`
	R           string            `json:"r"`
	Python      string            `json:"python"`
}

type PostDeploymentsReponse struct {
	LocalID state.LocalDeploymentID `json:"localId"` // Unique ID of this publishing operation. Only valid for this run of the agent.
}

var stateFactory = state.New
var publisherFactory = publish.NewFromState

func PostDeploymentHandlerFunc(
	base util.AbsolutePath,
	log logging.Logger,
	accountList accounts.AccountList,
	emitter events.Emitter) http.HandlerFunc {

	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostDeploymentRequestBody
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		localID, err := state.NewLocalID()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		newState, err := stateFactory(projectDir, b.AccountName, b.ConfigName, name, "", accountList, b.Secrets, b.Insecure)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				log.Error("Deployment initialization failure - account not found", "error", err.Error())
				NotFound(w, log, err)
				return
			}
			if errors.Is(err, state.ErrServerURLMismatch) {
				log.Error("Deployment initialization failure - Server URL Mismatch", "error", err.Error())
				// Redeployments must go to the same server
				w.WriteHeader(http.StatusConflict)
				w.Write([]byte(err.Error()))
				return
			}
			if aerr, ok := types.IsAgentError(err); ok {
				if aerr.Code == types.ErrorUnknownTOMLKey {
					apiErr := types.APIErrorUnknownTOMLKeyFromAgentError(*aerr)
					log.Error("Deployment initialization failure", "apiErr", apiErr.Error())
					apiErr.JSONResponse(w)
					return
				}
				if aerr.Code == types.ErrorInvalidTOML {
					apiErr := types.APIErrorInvalidTOMLFileFromAgentError(*aerr)
					log.Error("Deployment initialization failure", "apiErr", apiErr.Error())
					apiErr.JSONResponse(w)
					return
				}
				if aerr.Code == types.ErrorTomlValidationError {
					configPath := config.GetConfigPath(projectDir, b.ConfigName)
					apiErr := types.APIErrorTomlValidationFromAgentError(*aerr, configPath.String())
					log.Error("Deployment initialization failure", "apiErr", apiErr.Error())
					apiErr.JSONResponse(w)
					return
				}
				if aerr.Code == types.ErrorTomlUnknownError {
					configPath := config.GetConfigPath(projectDir, b.ConfigName)
					apiErr := types.APIErrorTomlUnknownErrorFromAgentError(*aerr, configPath.String())
					log.Error("Deployment initialization failure", "apiErr", apiErr.Error())
					apiErr.JSONResponse(w)
					return
				}
			}
			BadRequest(w, req, log, err)
			return
		}
		log.Debug("New account derived state created", "account", b.AccountName, "config", b.ConfigName)

		response := PostDeploymentsReponse{
			LocalID: localID,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(response)

		log := log.WithArgs("local_id", localID)
		newState.LocalID = localID
		rExecutable := util.NewPath(b.R, nil)
		pythonExecutable := util.NewPath(b.Python, nil)
		publisher, err := publisherFactory(newState, rExecutable, pythonExecutable, emitter, log)
		log.Debug("New publisher derived from state", "account", b.AccountName, "config", b.ConfigName)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		go func() {
			err = publisher.PublishDirectory()
			if err != nil {
				log.Error("Deployment failed", "error", err.Error())
				return
			}
		}()
	}
}
