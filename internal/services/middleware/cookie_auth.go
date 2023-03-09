package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/chmike/securecookie"
	"github.com/rstudio/platform-lib/pkg/rslog"

	"github.com/rstudio/connect-client/internal/util"
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
func CookieSession(logger rslog.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		_, err := cookieObj.GetValue(nil, req)
		if err != nil {
			// Proceed without auth.
			if err != http.ErrNoCookie {
				logger.Errorf("Error checking for session cookie: %s", err)
			}
			next(w, req)
		} else {
			// Any valid cookie (signed with our key) is accepted.
			req = authenticatedRequest(req)
			next(w, req)
		}
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
