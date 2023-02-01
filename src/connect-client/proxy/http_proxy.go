package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/debug"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type proxy struct {
	targetURL    string
	sourcePath   string
	baseDirector func(req *http.Request)
	logger       rslog.Logger
	debugLogger  rslog.DebugLogger
}

// NewProxy creates a proxy that will accept requests
// on the path `sourcePath` and proxy them to the
// server and path contained in `targetURL`.
// The `sourcePath` is removed during proxying.
func NewProxy(
	targetURL *url.URL,
	sourcePath string,
	logger rslog.Logger) *httputil.ReverseProxy {

	proxy := proxy{
		targetURL:    targetURL.String(),
		sourcePath:   sourcePath,
		baseDirector: httputil.NewSingleHostReverseProxy(targetURL).Director,
		logger:       logger,
		debugLogger:  rslog.NewDebugLogger(debug.ProxyRegion),
	}
	return proxy.asReverseProxy()
}

// NewProxyRequestHandler wraps a proxy in a request handler function.
func NewProxyRequestHandler(proxy *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	}
}

func (p *proxy) asReverseProxy() *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Director:       p.director,
		ModifyResponse: p.modifyResponse,
		ErrorHandler:   p.handleError,
	}
}

func (p *proxy) director(req *http.Request) {
	p.logRequest("Proxy request in", req)
	p.stripSourcePrefix(req)
	p.baseDirector(req)
	req.Host = req.URL.Host
	req.Header.Set("Host", req.Host)
	p.logRequest("Proxy request out", req)
}

func (p *proxy) logRequest(msg string, req *http.Request) {
	if p.debugLogger.Enabled() {
		p.debugLogger.WithFields(rslog.Fields{
			"method": req.Method,
			"url":    req.URL.String(),
		}).Debugf("%s", msg)
		//req.Header.Write(os.Stderr)
	}
}

func (p *proxy) logResponse(resp *http.Response) {
	if p.debugLogger.Enabled() {
		p.debugLogger.WithFields(rslog.Fields{
			"status": strconv.Itoa(resp.StatusCode),
			"length": resp.ContentLength,
			"url":    resp.Request.URL.String(),
			"server": resp.Header["Server"],
		}).Debugf("Proxy response")
	}
}

func (p *proxy) modifyResponse(resp *http.Response) error {
	// Rewrite outbound absolute redirects
	p.logResponse(resp)
	location := resp.Header.Get("Location")
	if strings.HasPrefix(location, p.targetURL) {
		relativePath := strings.TrimPrefix(location, p.targetURL)
		newLocation := urlPathJoin(p.sourcePath, relativePath)
		resp.Header.Set("Location", newLocation)
		p.debugLogger.Debugf("Rewrite redirect %s to %s", location, newLocation)
	}
	return nil
}

func (p *proxy) handleError(w http.ResponseWriter, req *http.Request, err error) {
	p.logger.Errorf("Proxy error on %s: %s", req.URL, err)
	w.WriteHeader(http.StatusBadGateway)
}

func (p *proxy) stripSourcePrefix(req *http.Request) {
	path := strings.TrimPrefix(req.URL.Path, p.sourcePath)
	if path == "" {
		path = "/"
	}
	req.URL.Path = path
}

func urlPathJoin(a, b string) string {
	return strings.TrimSuffix(a, "/") + "/" + strings.TrimPrefix(b, "/")
}
