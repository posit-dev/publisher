package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
)

type PostAccountVerifyResponse struct {
	*connect.User
	Error string `json:"error"`
}

func PostAccountVerifyHandlerFunc(lister accounts.AccountList, log logging.Logger) http.HandlerFunc {
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
		client, err := connect.NewConnectClient(account, 30*time.Second, events.NewNullEmitter(), log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		var response *PostAccountVerifyResponse
		user, err := client.TestAuthentication(log)

		if err != nil {
			response = &PostAccountVerifyResponse{
				Error: err.Error(),
			}
		} else {
			response = &PostAccountVerifyResponse{
				User: user,
			}
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
