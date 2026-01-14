package api

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PostOpenConnectContentRequestBody struct {
	ServerURL   string `json:"serverUrl"`
	ContentGUID string `json:"contentGuid"`
}

var connectOpenClientFactory = connect.NewConnectClient

// Handle the open-connect-content workflow by downloading the active bundle and staging it locally.
func PostOpenConnectContentHandlerFunc(lister accounts.AccountList, log logging.Logger, emitter events.Emitter) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var body PostOpenConnectContentRequestBody
		if err := dec.Decode(&body); err != nil {
			BadRequest(w, req, log, err)
			return
		}
		if body.ServerURL == "" || body.ContentGUID == "" {
			BadRequest(w, req, log, errors.New("serverUrl and contentGuid are required"))
			return
		}
		normalizedURL, err := util.NormalizeServerURL(body.ServerURL)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		account, err := findAccountByURL(lister, normalizedURL)
		if err != nil {
			NotFound(w, log, err)
			return
		}
		if !account.HasCredential() {
			NotFound(w, log, fmt.Errorf("no credentials for server '%s'", normalizedURL))
			return
		}
		client, err := connectOpenClientFactory(account, DefaultTimeout, emitter, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		connectClient, ok := client.(*connect.ConnectClient)
		if !ok {
			InternalError(w, req, log, errors.New("unexpected connect client type"))
			return
		}
		bundleID, err := connectClient.LatestBundleID(types.ContentID(body.ContentGUID), log)
		if err != nil {
			if handleConnectAPIError(w, log, err, normalizedURL, body.ContentGUID) {
				return
			}
			InternalError(w, req, log, err)
			return
		}
		bundleBytes, err := connectClient.DownloadBundle(types.ContentID(body.ContentGUID), bundleID, log)
		if err != nil {
			if handleConnectAPIError(w, log, err, normalizedURL, body.ContentGUID) {
				return
			}
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("Content-Type", "application/gzip")
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(bundleBytes); err != nil {
			log.Error("Failed to write connect bundle response", "error", err)
		}
	}
}

// Select the account that matches the requested server URL for content access.
func findAccountByURL(lister accounts.AccountList, serverURL string) (*accounts.Account, error) {
	accountsList, err := lister.GetAllAccounts()
	if err != nil {
		return nil, err
	}
	for _, account := range accountsList {
		normalizedAccount, err := util.NormalizeServerURL(account.URL)
		if err != nil {
			continue
		}
		if normalizedAccount == serverURL {
			return &account, nil
		}
	}
	return nil, fmt.Errorf("there is no account for the server '%s'", serverURL)
}

func handleConnectAPIError(
	w http.ResponseWriter,
	log logging.Logger,
	err error,
	serverURL, contentGUID string,
) bool {
	agentErr, ok := types.IsAgentError(err)
	if !ok {
		return false
	}
	message := connectAgentErrorMessage(agentErr)
	log.Error(
		"Connect API rejected the open content request",
		"server", serverURL,
		"content", contentGUID,
		"error", err,
	)
	switch agentErr.Code {
	case events.AuthenticationFailedCode:
		http.Error(w, message, http.StatusUnauthorized)
		return true
	case events.PermissionsCode:
		http.Error(w, message, http.StatusForbidden)
		return true
	default:
		return false
	}
}

func connectAgentErrorMessage(agentErr *types.AgentError) string {
	if errMsg, ok := agentErr.Data["error"].(string); ok && strings.TrimSpace(errMsg) != "" {
		return errMsg
	}
	if agentErr.Err != nil {
		return agentErr.Err.Error()
	}
	if agentErr.Message != "" {
		return agentErr.Message
	}
	return "unexpected response from Connect server"
}
