package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type proxyHelper struct {
	serverURL   string
	proxyPath   string
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func newProxyHelper(
	serverURL string,
	proxyPath string,
	logger rslog.Logger,
	debugLogger rslog.DebugLogger) *proxyHelper {

	return &proxyHelper{
		serverURL:   serverURL,
		proxyPath:   proxyPath,
		logger:      logger,
		debugLogger: debugLogger,
	}
}

func (h *proxyHelper) StripSourcePrefix(req *http.Request) {
	path := strings.TrimPrefix(req.URL.Path, h.proxyPath)
	if path == "" {
		path = "/"
	}
	req.URL.Path = path
}

func urlPathJoin(a, b string) string {
	return strings.TrimSuffix(a, "/") + "/" + strings.TrimPrefix(b, "/")
}

func (h *proxyHelper) ModifyResponse(resp *http.Response) error {
	h.debugLogger.Debugf("Proxy response: %s (%d bytes) from %s", resp.Status, resp.ContentLength, resp.Header["Server"])

	// Rewrite outbound absolute redirects
	location := resp.Header.Get("Location")
	if strings.HasPrefix(location, h.serverURL) {
		relativePath := strings.TrimPrefix(location, h.serverURL)
		newLocation := urlPathJoin(h.proxyPath, relativePath)
		resp.Header.Set("Location", newLocation)
		h.debugLogger.Debugf("Rewrite redirect %s to %s", location, newLocation)
	}
	return nil
}

func (h *proxyHelper) ErrorHandler(w http.ResponseWriter, req *http.Request, err error) {
	h.logger.Errorf("Proxy error on %s: %s", req.URL, err)
	w.WriteHeader(http.StatusBadGateway)
}

// NewProxy creates a reverse proxy to the specified publishing server
func NewProxy(serverURL string, proxyPath string, logger rslog.Logger, debugLogger rslog.DebugLogger) (*httputil.ReverseProxy, error) {
	url, err := url.Parse(serverURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(url)
	helper := newProxyHelper(serverURL, proxyPath, logger, debugLogger)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		debugLogger.Debugf("Proxy req in:  %s %s", req.Method, req.URL)
		helper.StripSourcePrefix(req)
		originalDirector(req)
		req.Host = req.URL.Host
		req.Header.Set("Host", req.URL.Host)
		debugLogger.Debugf("Proxy req out: %s %s", req.Method, req.URL)
		req.Header.Write(os.Stderr)
	}
	proxy.ModifyResponse = helper.ModifyResponse
	proxy.ErrorHandler = helper.ErrorHandler
	return proxy, nil
}

// NewProxyRequestHandler creates a handler function that proxies the request
func NewProxyRequestHandler(proxy *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	}
}
