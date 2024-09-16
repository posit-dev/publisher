package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectRemoteResponseBody struct {
	// Configuration *config.Config `json:"configuration"`
	ProjectDir string                        `json:"projectDir"`
	ServerURL  string                        `json:"serverUrl"`
	ID         types.ContentID               `json:"id"`
	ContentDTO *connect.ConnectGetContentDTO `json:"contentDTO"`
	Config     *config.Config                `json:"config"`
	Manifest   *bundles.Manifest             `json:"manifest"`
}

func PostInspectRemoteHandlerFunc(
	base util.AbsolutePath,
	log logging.Logger,
	accountList accounts.AccountList,
) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		guid := vars["guid"]
		accountName := vars["name"]

		_, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		log.Info("POST inspect/remote was passed in", "ID", guid, "AccountName", accountName)

		acct, err := accountList.GetAccountByName(accountName)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				NotFound(w, log, err)
				return
			} else {
				InternalError(w, req, log, err)
				return
			}
		}

		apiClient, err := connect.NewConnectClient(acct, 30*time.Second, nil, log)
		if err != nil {
			agentErr := types.AsAgentError(err)
			if agentErr.Code == events.PermissionsCode {
				BadRequest(w, req, log, agentErr)
			} else {
				InternalError(w, req, log, err)
				return
			}
		}

		f := connect.NewConnectConfigFactory(apiClient, types.ContentID(guid), log)
		contentDTO, config, manifest, err := f.FromRemoteManifest()
		if err != nil {
			agentErr := types.AsAgentError(err)
			if agentErr.Code == events.PermissionsCode {
				BadRequest(w, req, log, agentErr)
			} else {
				InternalError(w, req, log, err)
				return
			}
		}

		// send what we know now.
		response := postInspectRemoteResponseBody{
			ProjectDir: relProjectDir.String(),
			ServerURL:  acct.URL,
			ID:         types.ContentID(guid),
			ContentDTO: contentDTO,
			Config:     config,
			Manifest:   manifest,
		}

		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
