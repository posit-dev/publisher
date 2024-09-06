package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/logging"
)

type getContentRequestBody struct {
	AccountName string `json:"account"`
}

type getContentResponseBody struct {
	// Configuration *config.Config `json:"configuration"`
	ContentItems []*connect.ConnectContentSummary
}

func GetContentHandlerFunc(
	log logging.Logger,
	accountList accounts.AccountList,
) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		accountName := mux.Vars(req)["name"]
		log.Info("GET content was passed in", "AccountName", accountName)

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

		contentItems, err := connect.ConnectContentSummaryFromServer(acct, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := &getContentResponseBody{
			ContentItems: contentItems,
		}
		w.WriteHeader(http.StatusOK)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
