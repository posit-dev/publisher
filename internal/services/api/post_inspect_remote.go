package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectRemoteRequestBody struct {
	AccountName string `json:"account"`
}

type postInspectRemoteResponseBody struct {
	// Configuration *config.Config `json:"configuration"`
	ProjectDir string          `json:"projectDir"`
	ServerURL  string          `json:"serverUrl"`
	ID         types.ContentID `json:"id,omitempty"`
}

func PostInspectRemoteHandlerFunc(
	base util.AbsolutePath,
	log logging.Logger,
	accountList accounts.AccountList,
) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		guid := mux.Vars(req)["guid"]
		_, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b postInspectRemoteRequestBody
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		log.Info("POST inspect/remote was passed in", "ID", guid, "AccountName", b.AccountName)

		acct, err := accountList.GetAccountByName(b.AccountName)
		if err != nil {
			if errors.Is(err, accounts.ErrAccountNotFound) {
				NotFound(w, log, err)
				return
			} else {
				InternalError(w, req, log, err)
				return
			}
		}

		response := postInspectRemoteResponseBody{}

		// send what we know now.
		response = postInspectRemoteResponseBody{
			ProjectDir: relProjectDir.String(),
			ServerURL:  acct.URL,
			ID:         types.ContentID(guid),
		}

		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
