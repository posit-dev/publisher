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
	sendError := false

	for {
		// Publish a payload to the messages stream
		data := ""

		if sendError {
			data = fmt.Sprintf("{ \"type\": \"log\", \"time\": \"%s\", \"data\": \"XYZ\" }", time.Now().UTC())
		} else {
			data = fmt.Sprintf("{ \"type\": \"error\", \"time\": \"%s\", \"data\": \"Woops!\" }", time.Now().UTC())
		}
		eventServer.Publish("messages",
			&sse.Event{
				Data:  []byte(data),
				Event: []byte("message"),
			},
		)
		sendError = !sendError
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
