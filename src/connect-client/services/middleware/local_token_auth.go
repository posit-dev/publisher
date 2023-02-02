package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

// LocalToken looks for a `token` query parameter. If
// present, it matches it against the (single) token
// generated at startup and included in the URL we
// present to the user. If it matches, redirect to the
// original URL without the token parameter and with a valid
// session cookie. A mismatch is an auth failure (401).
const tokenParameterName string = "token"

func LocalTokenSession(expectedToken string, logger rslog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		target := c.Request.URL
		receivedToken := target.Query().Get(tokenParameterName)
		if receivedToken != "" {
			if receivedToken == expectedToken {
				// Success
				logger.Infof("Authenticated via token, creating session")
				markContextAuthenticated(c)
				//setCookie()
				target.Query().Del(tokenParameterName)
				c.Redirect(http.StatusMovedPermanently, target.String())
			} else {
				// Failure
				logger.Errorf("Invalid authentication token: '%s'", receivedToken)
				c.AbortWithStatus(http.StatusUnauthorized)
			}
		} else {
			// No token in the request
			c.Next()
		}
	}
}
