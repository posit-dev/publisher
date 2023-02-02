package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/chmike/securecookie"
	"github.com/gin-gonic/gin"
	"github.com/rstudio/platform-lib/pkg/rslog"

	"connect-client/util"
)

const sessionCookieName string = "connect-client-session"

var cookieKey []byte = securecookie.MustGenerateRandomKey()

var cookieObj = securecookie.MustNew("session", cookieKey, securecookie.Params{
	HTTPOnly: true,
	Secure:   false, // we currently only serve over http
	SameSite: securecookie.Lax,
})

// CookieSession looks for a session cookie.
// If there is a cookie, and it is valid,
// the session is marked as authenticated.
// An invalid cookie results in auth failure (401).
func CookieSession(expectedToken string, logger rslog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, err := cookieObj.GetValue(nil, c.Request)
		if err != nil {
			if err == http.ErrNoCookie {
				// Proceed without auth.
				c.Next()
			} else {
				logger.Errorf("Error checking for session cookie: %s", err)
				return
			}
		}
		// Any valid cookie (signed with our key) is accepted.
		markContextAuthenticated(c)
		c.Next()
	}
}

func setCookie(w http.ResponseWriter) error {
	sessionID, err := util.RandomBytes(32)
	if err != nil {
		return err
	}
	cookieObj.SetValue(w, sessionID)
	return nil
}
