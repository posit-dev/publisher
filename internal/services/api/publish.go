package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/publishing-client/internal/accounts"
	"github.com/rstudio/publishing-client/internal/cli_types"
	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/publish"
)

func PostPublishHandlerFunc(publishArgs *cli_types.PublishArgs, lister accounts.AccountList, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			err := publish.PublishManifestFiles(publishArgs, lister, log)
			if err != nil {
				InternalError(w, req, log, err)
			}
		default:
			return
		}
	}
}
