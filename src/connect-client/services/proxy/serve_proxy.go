package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"net/url"

	"connect-client/debug"
	"connect-client/services"
	"connect-client/services/middleware"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type ProxyApplication struct {
	remoteName  string
	remoteUrl   string
	host        string
	port        int
	token       services.LocalToken
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func NewProxyApplication(
	remoteName string,
	remoteUrl string,
	host string,
	port int,
	token services.LocalToken,
	logger rslog.Logger) *ProxyApplication {

	return &ProxyApplication{
		remoteName:  remoteName,
		remoteUrl:   remoteUrl,
		host:        host,
		port:        port,
		token:       token,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.ProxyRegion),
	}
}

func (app *ProxyApplication) getPath() string {
	return fmt.Sprintf("/proxy/%s/", app.remoteName)
}

func (app *ProxyApplication) Run() error {
	router, err := app.configure()
	if err != nil {
		return err
	}

	addr := fmt.Sprintf("%s:%d", app.host, app.port)
	proxyURL := url.URL{
		Scheme: "http",
		Host:   addr,
		Path:   app.getPath(),
	}
	// Log without the token
	app.logger.Infof("Proxy server URL: %s", proxyURL.String())

	// Show the user the token
	proxyURL.RawQuery = url.Values{
		"token": []string{string(app.token)},
	}.Encode()
	fmt.Printf("%s\n", proxyURL.String())

	err = http.ListenAndServe(addr, router)
	if err != nil && err != http.ErrServerClosed {
		app.logger.Errorf("Proxy server error: %s", err)
		return err
	}
	return nil
}

func (app *ProxyApplication) configure() (http.HandlerFunc, error) {
	r := http.NewServeMux()

	// Proxy to Connect server for the publishing UI
	publishPath := app.getPath() + "publish/"
	remoteUrl, err := url.Parse(app.remoteUrl)
	if err != nil {
		return nil, err
	}

	proxy := NewProxy(remoteUrl, app.getPath(), app.logger)
	r.Handle(app.getPath(), proxy)

	h := r.ServeHTTP
	h = middleware.RootRedirect(app.getPath(), publishPath, h)
	h = middleware.AuthRequired(app.logger, h)
	h = middleware.CookieSession(app.logger, h)
	h = middleware.LocalTokenSession(app.token, app.logger, h)
	return h, nil
}
