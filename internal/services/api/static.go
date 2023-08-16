package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/web"
)

var prefix string = "/dist/spa"

func RegisterStaticFiles(router *mux.Router) {
	router.
		PathPrefix("/").
		Handler(middleware.AddPathPrefix(prefix, http.FileServer(http.FS(web.Dist)).ServeHTTP))
}
