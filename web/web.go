package web

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
	"net/http"
)

//go:embed dist
var dist embed.FS

const Prefix = "/dist"

type handler struct{}

// A Handler instance
var Handler handler = handler{}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	http.FileServer(http.FS(dist)).ServeHTTP(w, r)
}
