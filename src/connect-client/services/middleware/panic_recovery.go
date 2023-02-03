package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"runtime"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

func PanicRecovery(logger rslog.Logger, debugLogger rslog.DebugLogger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				buf := make([]byte, 2048)
				n := runtime.Stack(buf, false)
				logger.Errorf("Internal server error: %s", err)
				debugLogger.Debugf("Stack: \n%s", buf[:n])
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte("Internal Server Error"))
			}
		}()
		next(w, req)
	}
}
