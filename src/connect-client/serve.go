package connect_client

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

//go:embed static/*
var content embed.FS

type Application struct {
	urlPath string
	host    string
	port    int
	debug   bool
	logger  rslog.Logger
	server  *http.Server
}

func NewApplication(urlPath string, host string, port int, debug bool, logger rslog.Logger) *Application {
	return &Application{
		urlPath: urlPath,
		host:    host,
		port:    port,
		debug:   debug,
		logger:  logger,
	}
}

func (app *Application) getPath() string {
	path := "/static/"
	if app.urlPath != "" {
		path += app.urlPath
	}
	return path
}

func (app *Application) Run() error {
	router, err := app.configure()
	if err != nil {
		return err
	}

	addr := fmt.Sprintf("%s:%d", app.host, app.port)
	fmt.Printf("http://%s%s\n", addr, app.getPath())

	err = http.ListenAndServe(addr, router)
	if err != nil && err != http.ErrServerClosed {
		app.logger.Errorf("UI server error: %s", err)
		return err
	}
	return nil
}

func (app *Application) configure() (*gin.Engine, error) {
	if !app.debug {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()

	// middleware
	r.Use(gin.Recovery())
	// r.Use(middleware.SecurityHeaders())
	// if app.debug {
	// 	r.Use(middleware.LogRequest())
	// }

	// static files for the local (server list) UI
	r.GET("", func(c *gin.Context) {
		c.Redirect(http.StatusTemporaryRedirect, app.getPath())
	})
	r.GET("static/*filepath", gin.WrapH(http.FileServer(http.FS(content))))

	// Proxy to Connect server for the publishing UI
	// ...
	// More APIs to come...
	return r, nil
}
