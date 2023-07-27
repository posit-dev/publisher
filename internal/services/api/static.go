package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/web"
)

var prefix string = "/dist/spa"

func NewStaticController() http.HandlerFunc {
	fs := http.FS(web.Dist)
	serv := http.FileServer(fs)
	return middleware.AddPathPrefix(prefix, serv.ServeHTTP)
}
