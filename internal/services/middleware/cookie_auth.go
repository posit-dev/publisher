package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/chmike/securecookie"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

const sessionCookieName string = "posit-publish-session"

var cookieKey []byte = securecookie.MustGenerateRandomKey()

var cookieObj = securecookie.MustNew(sessionCookieName, cookieKey, securecookie.Params{
	HTTPOnly: true,
	Secure:   false, // we currently only serve over http
	SameSite: securecookie.None,
})

// CookieSession looks for a posit-publish-session cookie.
// If there is a cookie, and it is valid,
// the session is marked as authenticated.
// An invalid cookie results in auth failure (401).
func CookieSession(log logging.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		_, err := cookieObj.GetValue([]byte(sessionCookieName), req)
		if err != nil {
			// Proceed without auth.
			if err != http.ErrNoCookie {
				log.Error("Error checking for cookie", "name", sessionCookieName, "error", err)
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
