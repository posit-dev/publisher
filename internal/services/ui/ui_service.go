package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"

	"github.com/r3labs/sse/v2"
)

const APIPrefix string = "api"

func PublishPing(eventServer *sse.Server) {
	mode := 0

	for {
		// Publish a payload to the messages stream
		data := ""

		if mode == 0 {
			data = fmt.Sprintf("{ \"type\": \"errors/fileSystem\", \"time\": \"%s\", \"data\": { \"path\": \"/usr/projects/shiny223\" } }", time.Now().UTC())
		} else if mode == 1 {
			data = fmt.Sprintf("{ \"type\": \"publishing/appCreation/log\", \"time\": \"%s\", \"data\": { \"msg\": \"App creation log message!\" } }", time.Now().UTC())
		} else if mode == 2 {
			data = fmt.Sprintf("{ \"type\": \"totally/unknown/event\", \"time\": \"%s\", \"data\": { \"msg\": \"Waa Haa Haa!\" } }", time.Now().UTC())
		}
		eventServer.Publish("messages",
			&sse.Event{
				Data:  []byte(data),
				Event: []byte("message"),
			},
		)
		// switch between modes.
		mode += 1
		if mode > 2 {
			mode = 0
		}
		time.Sleep(1000 * time.Millisecond)
	}
}

func NewUIService(
	fragment string,
	listen string,
	keyFile string,
	certFile string,
	openBrowser bool,
	openBrowserAt string,
	skipAuth bool,
	accessLog bool,
	token services.LocalToken,
	fs afero.Fs,
	logger rslog.Logger) *api.Service {

	eventServer := sse.New()
	eventServer.CreateStream("messages")

	handler := newUIHandler(fs, logger, eventServer)

	// TEMP - push data onto the channel
	go PublishPing(eventServer)
	logger.Infof("Started Ping Publish at %s", time.Now().UTC())

	return api.NewService(
		handler,
		listen,
		fragment,
		keyFile,
		certFile,
		openBrowser,
		openBrowserAt,
		skipAuth,
		accessLog,
		token,
		logger,
		rslog.NewDebugLogger(debug.UIRegion),
	)
}

func newUIHandler(fs afero.Fs, logger rslog.Logger, eventServer *sse.Server) http.HandlerFunc {
	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.NewAccountsController(fs, logger))
	// /api/files
	mux.Handle(ToPath("files"), api.NewFilesController(fs, logger))
	// /api/events
	mux.HandleFunc(ToPath("/events"), eventServer.ServeHTTP)

	mux.HandleFunc("/", api.NewStaticController())

	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
