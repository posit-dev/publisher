package connect_client

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/middleware"
	"connect-client/proxy"
	"fmt"
	"net/http"

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
	debug bool,
	logger rslog.Logger,
	debugLogger rslog.DebugLogger) *ProxyApplication {

	return &ProxyApplication{
		remoteName:  remoteName,
		remoteUrl:   remoteUrl,
		host:        host,
		port:        port,
		debug:       debug,
		logger:      logger,
		debugLogger: debugLogger,
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

	err = http.ListenAndServe(addr, router)
	if err != nil && err != http.ErrServerClosed {
		app.logger.Errorf("Proxy server error: %s", err)
		return err
	}
	return nil
}

func (app *ProxyApplication) configure() (*gin.Engine, error) {
	if app.debug {
		gin.DebugPrintRouteFunc = debugPrintRouteFunc(app.debugLogger)
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
	p, err := proxy.NewProxy(app.remoteUrl, app.getPath(), app.logger, app.debugLogger)
	if err != nil {
		return nil, err
	}
	handler := proxy.NewProxyRequestHandler(p)
	r.Any(app.getPath()+"*path", gin.WrapF(handler))
	return r, nil
}

func debugPrintRouteFunc(debugLogger rslog.DebugLogger) func(string, string, string, int) {
	return func(httpMethod, absolutePath, handlerName string, _ int) {
		debugLogger.WithFields(rslog.Fields{
			"method":  httpMethod,
			"path":    absolutePath,
			"handler": handlerName,
		}).Debugf("Route defined")
	}
}
