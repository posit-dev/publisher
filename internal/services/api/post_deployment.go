package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
)

type PostDeploymentRequestBody struct {
	AccountName string `json:"account"`
	ConfigName  string `json:"config"`
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
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostDeploymentRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		localID, err := state.NewLocalID()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		newState, err := stateFactory(base, b.AccountName, b.ConfigName, name, "", accountList)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				NotFound(w, log, err)
			} else if errors.Is(err, state.ErrServerURLMismatch) {
				// Redeployments must go to the same server
				w.WriteHeader(http.StatusConflict)
				w.Write([]byte(err.Error()))
				return
			} else {
				BadRequest(w, req, log, err)
			}
			return
		}

		response := PostDeploymentsReponse{
			LocalID: localID,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(response)

		newState.LocalID = localID
		publisher, err := publisherFactory(newState, emitter, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		go func() {
			log := log.WithArgs("local_id", localID)
			err = publisher.PublishDirectory(log)
			if err != nil {
				log.Error("Deployment failed", "error", err.Error())
				return
			}
		}()
	}
}
