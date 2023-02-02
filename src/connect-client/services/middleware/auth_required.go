package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

// AuthRequired verifies that the session has been
// marked as authenticated by one of the auth middlewares.
const authenticatedContextKey string = "authenticated"

func AuthRequired(logger rslog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if isContextAuthenticated(c) {
			c.Next()
		} else {
			c.AbortWithStatus(http.StatusUnauthorized)
		}
	}
}

func markContextAuthenticated(c *gin.Context) {
	c.Set(authenticatedContextKey, true)
}

func isContextAuthenticated(c *gin.Context) bool {
	_, ok := c.Get(authenticatedContextKey)
	return ok
}
