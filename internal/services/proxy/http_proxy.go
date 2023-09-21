package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"log/slog"

	"github.com/rstudio/connect-client/internal/logging"
)

type proxy struct {
	targetURL  string
	sourcePath string
	baseProxy  *httputil.ReverseProxy
	log        logging.Logger
}

// NewProxy creates a proxy that will accept requests
// on the path `sourcePath` and proxy them to the
// server and path contained in `targetURL`.
// The `sourcePath` is removed during proxying.
func NewProxy(
	targetURL *url.URL,
	sourcePath string,
	log logging.Logger) *httputil.ReverseProxy {

	p := proxy{
		targetURL:  targetURL.String(),
		sourcePath: sourcePath,
		baseProxy:  httputil.NewSingleHostReverseProxy(targetURL),
		log:        log,
	}
	return p.asReverseProxy()
}

func (p *proxy) asReverseProxy() *httputil.ReverseProxy {
	proxy := *p.baseProxy
	proxy.Director = p.director
	proxy.ModifyResponse = p.modifyResponse
	proxy.ErrorHandler = p.handleError
	return &proxy
}

// fixReferer rewrites the referer to be on the Connect server.
func (p *proxy) fixReferer(req *http.Request) error {
	referer := req.Header.Get("Referer")
	if referer == "" {
		return nil
	}
	targetURL, err := p.proxyURL(referer)
	if err != nil {
		return err
	}
	req.Header.Set("Referer", targetURL)
	return nil
}

// proxyURL uses the base proxy director to map an
// URL to the target server.
func (p *proxy) proxyURL(sourceURL string) (string, error) {
	tempRequest, err := http.NewRequest("GET", sourceURL, nil)
	if err != nil {
		return "", err
	}
	p.stripSourcePrefix(tempRequest)
	p.baseProxy.Director(tempRequest)
	return tempRequest.URL.String(), nil
}

func (p *proxy) director(req *http.Request) {
	p.logRequest("Proxy request in", req)
	p.stripSourcePrefix(req)
	p.baseProxy.Director(req)
	p.fixReferer(req)
	req.Host = req.URL.Host
	req.Header.Set("Host", req.Host)

	// Don't pass through cookies, since we only load
	// unauthenticated resources (the publishing UI)
	// from the target server.
	req.Header.Del("Cookie")
	p.logRequest("Proxy request out", req)
}

func (p *proxy) modifyResponse(resp *http.Response) error {
	// Rewrite outbound absolute redirects
	location := resp.Header.Get("Location")
	if strings.HasPrefix(location, p.targetURL) {
		relativePath := strings.TrimPrefix(location, p.targetURL)
		newLocation, err := url.JoinPath(p.sourcePath, relativePath)
		if err != nil {
			return err
		}
		resp.Header.Set("Location", newLocation)
		p.log.Debug("Rewrite Location", "old", location, "new", newLocation)
	}
	return nil
}

func (p *proxy) handleError(w http.ResponseWriter, req *http.Request, err error) {
	p.log.Error("Proxy error", "url", req.URL, "error", err)
	w.WriteHeader(http.StatusBadGateway)
}

func (p *proxy) stripSourcePrefix(req *http.Request) {
	path := strings.TrimPrefix(req.URL.Path, p.sourcePath)
	if path == "" {
		path = "/"
	}
	req.URL.Path = path
}

func (p *proxy) logRequest(msg string, req *http.Request) {
	if p.log.Enabled(context.Background(), slog.LevelDebug) {
		p.log.Debug(msg, "method", req.Method, "url", req.URL.String())
		p.logHeader("Request headers", req.Header)
	}
}

type headerName string

func (p *proxy) logHeader(msg string, header http.Header) {
	log := p.log
	for name, values := range header {
		var value string
		if name == "Cookie" || name == "Authorization" {
			value = "REDACTED"
		} else {
			if len(values) == 1 {
				value = values[0]
			} else {
				value = fmt.Sprintf("%v", values)
			}
		}
		log = log.WithArgs(headerName(name), value)
	}
	log.Debug(msg)
}
