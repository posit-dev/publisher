package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"

	"connect-client/debug"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type proxy struct {
	targetURL   string
	sourcePath  string
	baseProxy   *httputil.ReverseProxy
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

// NewProxy creates a proxy that will accept requests
// on the path `sourcePath` and proxy them to the
// server and path contained in `targetURL`.
// The `sourcePath` is removed during proxying.
func NewProxy(
	targetURL *url.URL,
	sourcePath string,
	logger rslog.Logger) *httputil.ReverseProxy {

	p := proxy{
		targetURL:   targetURL.String(),
		sourcePath:  sourcePath,
		baseProxy:   httputil.NewSingleHostReverseProxy(targetURL),
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.ProxyRegion),
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
	p.logRequest("Proxy request out", req)
}

func (p *proxy) logRequest(msg string, req *http.Request) {
	if p.debugLogger.Enabled() {
		p.debugLogger.WithFields(rslog.Fields{
			"method": req.Method,
			"url":    req.URL.String(),
		}).Debugf("%s", msg)

		req.Header.Write(os.Stderr)
		os.Stderr.Write([]byte{'\n'})
	}
}

func (p *proxy) logResponse(resp *http.Response) {
	if p.debugLogger.Enabled() {
		p.debugLogger.WithFields(rslog.Fields{
			"status":         strconv.Itoa(resp.StatusCode),
			"length":         resp.ContentLength,
			"url":            resp.Request.URL.String(),
			"server":         resp.Header["Server"],
			"correlation-id": resp.Header.Get("X-Correlation-Id"),
		}).Debugf("Proxy response")
	}
}

func (p *proxy) modifyResponse(resp *http.Response) error {
	// Rewrite outbound absolute redirects
	p.logResponse(resp)
	location := resp.Header.Get("Location")
	if strings.HasPrefix(location, p.targetURL) {
		relativePath := strings.TrimPrefix(location, p.targetURL)
		newLocation, err := url.JoinPath(p.sourcePath, relativePath)
		if err != nil {
			return err
		}
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
