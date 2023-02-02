package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
	"fmt"
	"net/http"
	"net/url"

	"connect-client/debug"
	"connect-client/services"
	"connect-client/services/middleware"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

//go:embed static/*
var content embed.FS

type UIApplication struct {
	urlPath     string
	host        string
	port        int
	token       services.LocalToken
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func NewUIApplication(urlPath string, host string, port int, token services.LocalToken, logger rslog.Logger) *UIApplication {
	return &UIApplication{
		urlPath:     urlPath,
		host:        host,
		port:        port,
		token:       token,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.UIRegion),
	}
}

func (app *UIApplication) getPath() string {
	return "/static/" + app.urlPath
}

func (app *UIApplication) Run() error {
	router, err := app.configure()
	if err != nil {
		return err
	}

	addr := fmt.Sprintf("%s:%d", app.host, app.port)
	appURL := url.URL{
		Scheme: "http",
		Host:   addr,
		Path:   app.getPath(),
	}
	// Log without the token
	app.logger.Infof("Local UI server URL: %s", appURL.String())

	// Show the user the token
	appURL.RawQuery = url.Values{
		"token": []string{string(app.token)},
	}.Encode()
	fmt.Printf("%s\n", appURL.String())

	url := fmt.Sprintf("http://%s%s?token=%s", addr, app.getPath(), app.token)
	fmt.Printf("%s\n", url)
	app.logger.Infof("Local UI server URL: %s", url)

	err = http.ListenAndServe(addr, router)
	if err != nil && err != http.ErrServerClosed {
		app.logger.Errorf("UI server error: %s", err)
		return err
	}
	return nil
}

func (app *UIApplication) configure() (http.HandlerFunc, error) {
	r := http.NewServeMux()

	// static files for the local (server list) UI
	r.Handle("/static/", http.FileServer(http.FS(content)))

	// More APIs to come...
	h := r.ServeHTTP

	h = middleware.RootRedirect("/", app.getPath(), h)
	h = middleware.AuthRequired(app.logger, h)
	h = middleware.CookieSession(app.logger, h)
	h = middleware.LocalTokenSession(app.token, app.logger, h)
	return h, nil
}
