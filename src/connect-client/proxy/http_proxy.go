package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
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
	if h.debugLogger.Enabled() {
		h.debugLogger.WithFields(rslog.Fields{
			"code":   strconv.Itoa(resp.StatusCode),
			"status": resp.Status,
			"length": resp.ContentLength,
			"url":    resp.Request.URL.String(),
			"server": resp.Header["Server"],
		}).Debugf("Proxy response")
	}

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
		if debugLogger.Enabled() {
			debugLogger.WithFields(rslog.Fields{
				"method": req.Method,
				"url":    req.URL.String(),
			}).Debugf("Proxy request in")
		}
		helper.StripSourcePrefix(req)
		originalDirector(req)
		req.Host = req.URL.Host
		req.Header.Set("Host", req.Host)

		if debugLogger.Enabled() {
			debugLogger.WithFields(rslog.Fields{
				"method": req.Method,
				"url":    req.URL.String(),
			}).Debugf("Proxy request out")
		}
		//req.Header.Write(os.Stderr)
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
