package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func GetServerSettingsHandlerFunc(lister accounts.AccountList, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		account, err := lister.GetAccountByName(name)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}
		client, err := connectClientFactory(account, 30*time.Second, events.NewNullEmitter(), log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		base := util.NewAbsolutePath("/", nil)
		cfg := config.New()

		settings, err := client.GetSettings(base, cfg, log)
		if err != nil {
			fmt.Printf("Error getting server settings: %v\n", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(settings.General)
	}
}
