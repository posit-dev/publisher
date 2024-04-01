package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2023 by Posit Software, PBC.

type LogRequestSuite struct {
	utiltest.Suite
	log       logging.Logger
	logBuffer *bytes.Buffer
}

func TestLogRequestSuite(t *testing.T) {
	suite.Run(t, new(LogRequestSuite))
}

func (s *LogRequestSuite) SetupTest() {
	s.logBuffer = new(bytes.Buffer)
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	stdLogger := slog.New(slog.NewTextHandler(s.logBuffer, opts))
	s.log = logging.FromStdLogger(stdLogger)
}

func (s *LogRequestSuite) TestLogRequest() {
	path := "/api/foo"
	next := func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("hi there"))
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, path, nil)
	s.Nil(err)

	LogRequest("Access", s.log, http.HandlerFunc(next)).ServeHTTP(rec, req)

	message := s.logBuffer.String()
	s.Contains(message, "method=GET ")
	s.Contains(message, "url=/api/foo ")
	s.Contains(message, "elapsed_ms=")
	s.Contains(message, "status=200 ")
	s.Contains(message, "req_size=0 ")
	s.Contains(message, "resp_size=8 ")
	s.Contains(message, "client_addr=")
}

func (s *LogRequestSuite) TestLogRequestJson() {
	path := "/api/bar"
	next := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}

	body := `{"hi": "there", "what": "huh?"}`
	rec := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodPost, path, strings.NewReader(body))
	s.Nil(err)
	req.Header.Set("Content-Type", "application/json")

	LogRequest("Access", s.log, http.HandlerFunc(next)).ServeHTTP(rec, req)

	message := s.logBuffer.String()
	s.Contains(message, "method=POST ")
	s.Contains(message, "url=/api/bar ")
	s.Contains(message, "elapsed_ms=")
	s.Contains(message, "status=400 ")
	s.Contains(message, "req_size=31 ")
	s.Contains(message, "resp_size=0 ")
	s.Contains(message, "client_addr=")
	s.Contains(message, "hi=there")
	s.Contains(message, "what=huh?")
}
