// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/server_type"

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
		ServerType: server_type.ServerTypeConnect,
		Name:       "example",
		URL:        "http://example.com",
		ApiKey:     "12345",
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

func (s *PostCredentialTestSuite) Test201_ConnectCloud() {

	body := PostCredentialsRequest{
		ServerType:   server_type.ServerTypeConnectCloud,
		Name:         "example",
		AccountID:    "123",
		AccountName:  "my account",
		RefreshToken: "123",
		AccessToken:  "123",
	}

	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("POST", "http://example.com/api/credentials", bytes.NewBuffer(data))
	s.NoError(err)
	req.Header.Set("Connect-Cloud-Environment", "staging")

	rec := httptest.NewRecorder()
	h := PostCredentialFuncHandler(s.log)
	h(rec, req)

	s.Equal(http.StatusCreated, rec.Result().StatusCode)

	response := PostCredentialsResponse{}
	err = json.NewDecoder(rec.Body).Decode(&response)
	s.NoError(err)
	s.Equal(response.URL, "https://api.staging.connect.posit.cloud", "URL should be set according to the environment header")
}

func (s *PostCredentialTestSuite) Test409() {

	name := "example"
	url := "http://example.com"
	ak := "12345"

	cs, err := credentials.NewCredentialsService(s.log)
	s.NoError(err)

	_, err = cs.Set(credentials.CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: name, URL: url, ApiKey: ak})
	s.NoError(err)

	cred := PostCredentialsRequest{
		ServerType:          server_type.ServerTypeConnect,
		Name:                "collision",
		URL:                 "http://example.com",
		ApiKey:              "12345",
		SnowflakeConnection: "",
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
