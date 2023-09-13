package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"runtime"

	"github.com/rstudio/publishing-client/internal/logging"
)

func PanicRecovery(log logging.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				buf := make([]byte, 2048)
				n := runtime.Stack(buf, false)
				log.Error("Internal server error", "error", err)
				log.Debug("Stacktrace for previous error", "stack", buf[:n])
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte("Internal Server Error"))
			}
		}()
		next(w, req)
	}
}
