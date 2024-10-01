package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type PostCredentialsRequest struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	ApiKey string `json:"apiKey"`
}

type PostCredentialsResponse = credentials.Credential

func PostCredentialFuncHandler(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {

		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var body PostCredentialsRequest
		err := dec.Decode(&body)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		cs, err := credentials.NewCredentialsService(log)
		if err != nil {
			if aerr, ok := err.(*types.AgentError); ok {
				if aerr.Code == types.ErrorCredentialServiceUnavailable {
					apiErr := APIErrorCredentialsUnavailableFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}
			}
			InternalError(w, req, log, err)
			return
		}

		cred, err := cs.Set(body.Name, body.URL, body.ApiKey)
		if err != nil {
			if _, ok := err.(*credentials.URLCollisionError); ok {
				http.Error(w, http.StatusText(http.StatusConflict), http.StatusConflict)
				return
			}
			InternalError(w, req, log, err)
			return
		}

		JsonResult(w, http.StatusCreated, cred)
	}
}
