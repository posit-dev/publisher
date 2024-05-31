// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
)

type PostCredentialTestSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestPostCredentialTestSuite(t *testing.T) {
	suite.Run(t, new(PostCredentialTestSuite))
}

func (s *PostCredentialTestSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostCredentialTestSuite) SetupTest() {
	keyring.MockInit()
}

func (s *PostCredentialTestSuite) Test201() {

	body := PostCredentialsRequest{
		Name:   "example",
		URL:    "http://example.com",
		ApiKey: "12345",
	}

	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("POST", "http://example.com/api/credentials", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	h := PostCredentialFuncHandler(s.log)
	h(rec, req)

	s.Equal(http.StatusCreated, rec.Result().StatusCode)
}

func (s *PostCredentialTestSuite) Test409() {

	name := "example"
	url := "http://example.com"
	ak := "12345"

	cs := credentials.CredentialsService{}
	_, err := cs.Set(name, url, ak)
	s.NoError(err)

	cred := PostCredentialsRequest{
		Name:   "collision",
		URL:    "http://example.com",
		ApiKey: "12345",
	}

	data, err := json.Marshal(cred)
	s.NoError(err)

	req, err := http.NewRequest("POST", "http://example.com/api/credentials", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	h := PostCredentialFuncHandler(s.log)
	h(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}
