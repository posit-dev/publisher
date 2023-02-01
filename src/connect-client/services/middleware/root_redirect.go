package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RootRedirect redirects root requests to a specified path
func RootRedirect(rootPath, targetPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == rootPath {
			c.Redirect(http.StatusMovedPermanently, targetPath)
		} else {
			c.Next()
		}
	}
}
