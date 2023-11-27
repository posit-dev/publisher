package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type PostPublishRequestBody struct {
	AccountName string `json:"account"`
	ConfigName  string `json:"config"`
	TargetID    string `json:"target"`
}

type PostPublishReponse struct {
	LocalID state.LocalDeploymentID `json:"local_id"` // Unique ID of this publishing operation. Only valid for this run of the agent.
}

type PublisherFactory = func(*state.State) publish.Publisher
type StateFactory = func(
	path util.Path,
	accountName, configName, targetID string,
	accountList accounts.AccountList) (*state.State, error)

func PostPublishHandlerFunc(
	stateStore *state.State,
	base util.Path,
	log logging.Logger,
	accountList accounts.AccountList,
	stateFactory StateFactory,
	publisherFactory PublisherFactory) http.HandlerFunc {

	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostPublishRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequestJson(w, req, log, err)
			return
		}
		if b.ConfigName == "" {
			b.ConfigName = config.DefaultConfigName
		}
		localID, err := state.NewLocalID()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		newState, err := stateFactory(base, b.AccountName, b.ConfigName, b.TargetID, accountList)
		if err != nil {
			BadRequestJson(w, req, log, err)
			return
		}
		response := PostPublishReponse{
			LocalID: localID,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(response)

		*stateStore = *newState
		stateStore.LocalID = localID

		go func() {
			log = log.WithArgs("local_id", localID)
			publisher := publisherFactory(stateStore)
			err = publisher.PublishDirectory(log)
			if err != nil {
				log.Error("Deployment failed", "error", err.Error())
				return
			}
		}()
	}
}
