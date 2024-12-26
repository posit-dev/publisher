// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/credentials/credentialstest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type GetCredentialsSuite struct {
	utiltest.Suite
	log          logging.Logger
	credservice  *credentialstest.CredentialsServiceMock
	credsFactory credentials.CredServiceFactory
}

func TestGetCredentialsSuite(t *testing.T) {
	suite.Run(t, new(GetCredentialsSuite))
}

func (s *GetCredentialsSuite) SetupTest() {
	s.log = logging.New()
	s.credservice = credentialstest.NewCredentialsServiceMock()
	s.credsFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return s.credservice, nil
	}
}

func (s *GetCredentialsSuite) TestGetCredsList_Empty() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("GET", path, nil)
	s.NoError(err)

	s.credservice.On("List").Return([]credentials.Credential{}, nil)

	rec := httptest.NewRecorder()
	h := GetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	var res []credentials.Credential
	dec := json.NewDecoder(rec.Body)
	s.NoError(dec.Decode(&res))
	s.Len(res, 0)
	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *GetCredentialsSuite) TestGetCredsListOk() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("GET", path, nil)
	s.NoError(err)

	fakeCredsList := []credentials.Credential{
		{
			GUID:   "44a468b8-09c7-4c6d-a7a3-8cf164ddbaf8",
			Name:   "one",
			URL:    "https://one.com/connect",
			ApiKey: "123456",
		},
		{
			GUID:   "1b48b862-ce66-484c-9f03-a39870a0cfb5",
			Name:   "two",
			URL:    "https://two.com/connect",
			ApiKey: "123456",
		},
	}
	s.credservice.On("List").Return(fakeCredsList, nil)

	rec := httptest.NewRecorder()
	h := GetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	var res []credentials.Credential
	dec := json.NewDecoder(rec.Body)
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)
	s.Equal(res, fakeCredsList)
	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *GetCredentialsSuite) TestGetCredsList_LoadError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("GET", path, nil)
	s.NoError(err)

	credsError := credentials.NewLoadError(errors.New("could not load!"))
	s.credservice.On("List").Return([]credentials.Credential{}, credsError)

	rec := httptest.NewRecorder()
	h := GetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusConflict, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsCorrupted"}`)
}

func (s *GetCredentialsSuite) TestGetCredsList_CorruptedError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("GET", path, nil)
	s.NoError(err)

	credsError := credentials.NewCorruptedError("qwerty")
	s.credservice.On("List").Return([]credentials.Credential{}, credsError)

	rec := httptest.NewRecorder()
	h := GetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusConflict, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsCorrupted"}`)
}

func (s *GetCredentialsSuite) TestGetCredsList_UnknownServiceErr() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("GET", path, nil)
	s.NoError(err)

	credsError := errors.New("something errrddd")
	s.credservice.On("List").Return([]credentials.Credential{}, credsError)

	rec := httptest.NewRecorder()
	h := GetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusServiceUnavailable, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsServiceUnavailable"}`)
}
