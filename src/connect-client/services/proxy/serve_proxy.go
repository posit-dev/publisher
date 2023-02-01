package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/debug"
	"connect-client/middleware"
	"fmt"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type ProxyApplication struct {
	remoteName  string
	remoteUrl   string
	host        string
	port        int
	debug       bool
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func NewProxyApplication(
	remoteName string,
	remoteUrl string,
	host string,
	port int,
	logger rslog.Logger) *ProxyApplication {

	return &ProxyApplication{
		remoteName:  remoteName,
		remoteUrl:   remoteUrl,
		host:        host,
		port:        port,
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
	url := fmt.Sprintf("http://%s%s", addr, app.getPath())
	fmt.Printf("%s\n", url)
	app.logger.Infof("Proxy server URL: %s", url)

	err = http.ListenAndServe(addr, router)
	if err != nil && err != http.ErrServerClosed {
		app.logger.Errorf("Proxy server error: %s", err)
		return err
	}
	return nil
}

func (app *ProxyApplication) configure() (*gin.Engine, error) {
	if app.debug {
		gin.DebugPrintRouteFunc = debug.DebugPrintRouteFunc(app.debugLogger)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()

	// middleware
	r.Use(gin.Recovery())
	// r.Use(middleware.SecurityHeaders())
	publishPath := app.getPath() + "publish/"
	r.Use(middleware.RootRedirect(app.getPath(), publishPath))

	// if app.debug {
	// 	r.Use(middleware.LogRequest())
	// }

	// Proxy to Connect server for the publishing UI
	remoteUrl, err := url.Parse(app.remoteUrl)
	if err != nil {
		return nil, err
	}

	proxy := NewProxy(remoteUrl, app.getPath(), app.logger)
	handler := NewProxyRequestHandler(proxy)
	r.Any(app.getPath()+"*path", gin.WrapF(handler))
	return r, nil
}
