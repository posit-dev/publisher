package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type HTTPSuite struct {
	utiltest.Suite
}

func TestHTTPSuite(t *testing.T) {
	suite.Run(t, new(HTTPSuite))
}

func (s *HTTPSuite) TestGetRequestBody() {
	expectedBody := []byte("hi there")
	req, err := http.NewRequest("GET", "/", bytes.NewReader(expectedBody))
	s.Nil(err)

	body, err := GetRequestBody(req)
	s.Nil(err)
	s.Equal(expectedBody, body)

	// Request body should still be readable
	rereadBody, err := io.ReadAll(req.Body)
	s.Nil(err)
	s.Equal(expectedBody, rereadBody)
}

func (s *HTTPSuite) TestGetRequestBodyNil() {
	req, err := http.NewRequest("GET", "/", nil)
	s.Nil(err)

	body, err := GetRequestBody(req)
	s.Nil(err)
	s.Nil(body)
}

func (s *HTTPSuite) TestGetRequestErr() {
	reqBody := utiltest.NewMockReader()
	testError := errors.New("test error from Read")
	reqBody.On("Read", mock.Anything).Return(0, testError)

	req, err := http.NewRequest("GET", "/", reqBody)
	s.Nil(err)

	body, err := GetRequestBody(req)
	s.ErrorIs(err, testError)
	s.Nil(body)
}

func (s *HTTPSuite) TestURLJoin() {
	s.Equal("a/b", URLJoin("a", "b"))
	s.Equal("a/b", URLJoin("a/", "b"))
	s.Equal("a/b", URLJoin("a", "/b"))
	s.Equal("a/b", URLJoin("a/", "/b"))

	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a", "b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a/", "b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a", "/b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a/", "/b"))
}
