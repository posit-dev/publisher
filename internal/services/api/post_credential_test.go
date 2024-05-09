// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/credentials"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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

	cred := credentials.Credential{
		Name:   "example",
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

	s.Equal(http.StatusCreated, rec.Result().StatusCode)
}

func (s *PostCredentialTestSuite) Test409() {

	cs := credentials.CredentialsService{}
	err := cs.Set(credentials.Credential{
		Name:   "existing",
		URL:    "http://example.com",
		ApiKey: "12345",
	})
	s.NoError(err)

	cred := credentials.Credential{
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
