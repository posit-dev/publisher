package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

// CookieSession looks for a session cookie.
// If there is a cookie, and it is valid,
// the session is marked as authenticated.
// An invalid cookie results in auth failure (401).
const sessionCookieName string = "connect-client-session"

func CookieSession(expectedToken string, logger rslog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		receivedCookie, err := c.Request.Cookie(sessionCookieName)
		if err != nil {
			if err == http.ErrNoCookie {
				c.Next()
			} else {
				logger.Errorf("Error checking for session cookie: %s", err)
				return
			}
		}
		if cookieIsValid(receivedCookie) {
			markContextAuthenticated(c)
			c.Next()
		} else {
			logger.Errorf("Invalid session cookie: '%s'", receivedCookie)
			c.AbortWithStatus(http.StatusUnauthorized)
		}
	}
}

func cookieIsValid(cookie *http.Cookie) bool {
	return false
}

func createCookie(c *gin.Context) {
	//c.SetCookie()
}
