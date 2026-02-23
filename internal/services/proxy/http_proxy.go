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

	"github.com/posit-dev/publisher/internal/logging"
)

type proxy struct {
	targetURL  *url.URL
	sourcePath string
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
		targetURL:  targetURL,
		sourcePath: sourcePath,
		log:        log,
	}
	return p.asReverseProxy()
}

func (p *proxy) asReverseProxy() *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Rewrite:        p.rewrite,
		ModifyResponse: p.modifyResponse,
		ErrorHandler:   p.handleError,
	}
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

// proxyURL maps a URL to the target server.
func (p *proxy) proxyURL(sourceURL string) (string, error) {
	parsed, err := url.Parse(sourceURL)
	if err != nil {
		return "", err
	}

	// Strip source prefix from path
	path := strings.TrimPrefix(parsed.Path, p.sourcePath)
	if path == "" {
		path = "/"
	}

	// Build target URL
	result := *p.targetURL
	result.Path = path
	result.RawQuery = parsed.RawQuery
	return result.String(), nil
}

func (p *proxy) rewrite(pr *httputil.ProxyRequest) {
	p.logRequest("Proxy request in", pr.In)

	// Set the target URL (scheme and host)
	pr.SetURL(p.targetURL)

	// Strip source prefix from path
	path := strings.TrimPrefix(pr.In.URL.Path, p.sourcePath)
	if path == "" {
		path = "/"
	}
	pr.Out.URL.Path = path

	// Preserve query string
	pr.Out.URL.RawQuery = pr.In.URL.RawQuery

	// Fix referer header
	p.fixReferer(pr.Out)

	// Set host headers
	pr.Out.Host = pr.Out.URL.Host
	pr.Out.Header.Set("Host", pr.Out.Host)

	// Don't pass through cookies, since we only load
	// unauthenticated resources (the publishing UI)
	// from the target server.
	pr.Out.Header.Del("Cookie")
	p.logRequest("Proxy request out", pr.Out)
}

func (p *proxy) modifyResponse(resp *http.Response) error {
	// Rewrite outbound absolute redirects
	location := resp.Header.Get("Location")
	targetURLStr := p.targetURL.String()
	if strings.HasPrefix(location, targetURLStr) {
		relativePath := strings.TrimPrefix(location, targetURLStr)
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
