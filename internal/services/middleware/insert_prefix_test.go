package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2023 by Posit Software, PBC.

type InsertPrefixSuite struct {
	utiltest.Suite
}

func TestInsertPrefixSuite(t *testing.T) {
	suite.Run(t, new(InsertPrefixSuite))
}

func (s *InsertPrefixSuite) TestInsertPrefix() {
	path := "/index.html"
	prefix := "prefix"
	fn := func(w http.ResponseWriter, r *http.Request) {
		s.Equal(prefix+path, r.URL.Path)
		s.Equal(prefix, r.URL.RawPath)
	}

	rec := httptest.NewRecorder()
	url := "http://www.example.com" + path
	req, err := http.NewRequest(http.MethodGet, url, nil)
	s.Nil(err)

	InsertPrefix(http.HandlerFunc(fn), prefix).ServeHTTP(rec, req)
}

func (s *InsertPrefixSuite) TestInsertPrefix_EmptyPrefix() {
	path := "/index.html"
	prefix := ""
	fn := func(w http.ResponseWriter, r *http.Request) {
		s.Equal(path, r.URL.Path)
		s.Equal("", r.URL.RawPath)
	}

	rec := httptest.NewRecorder()
	url := "http://www.example.com" + path
	req, err := http.NewRequest(http.MethodGet, url, nil)
	s.Nil(err)

	InsertPrefix(http.HandlerFunc(fn), prefix).ServeHTTP(rec, req)
}
