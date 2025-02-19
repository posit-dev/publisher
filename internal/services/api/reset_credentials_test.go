// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
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

type ResetCredsSuite struct {
	utiltest.Suite
	log          logging.Logger
	credservice  *credentialstest.CredentialsServiceMock
	credsFactory credentials.CredServiceFactory
}

func TestResetCredsSuite(t *testing.T) {
	suite.Run(t, new(ResetCredsSuite))
}

func (s *ResetCredsSuite) SetupTest() {
	s.log = logging.New()
	s.credservice = credentialstest.NewCredentialsServiceMock()
	s.credsFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return s.credservice, nil
	}
}

func (s *ResetCredsSuite) TestResetOk() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	s.credservice.On("Reset").Return("backup-file", nil)

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Contains(rec.Body.String(), `{"backupFile":"backup-file"}`)
}

func (s *ResetCredsSuite) TestReset_EvenWithLoadError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	// Even if factory returns a LoadError,
	// reset proceeds, that is the reason we are resetting data.
	s.credsFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return s.credservice, credentials.NewLoadError(errors.New("load errsss"))
	}

	s.credservice.On("Reset").Return("", nil)

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *ResetCredsSuite) TestReset_EvenWithCorruptedError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	// Even if factory returns a CorruptedError,
	// reset proceeds, that is the reason we are resetting data.
	s.credsFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return s.credservice, credentials.NewCorruptedError("qwerty")
	}

	s.credservice.On("Reset").Return("", nil)

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
}

func (s *ResetCredsSuite) TestReset_BackupFileError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	s.credservice.On("Reset").Return("", credentials.NewBackupFileAgentError("~/.connect-creds", errors.New("do not have write permissions")))

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsCannotBackupFile","details":{"filename":"~/.connect-creds","message":"Failed to backup credentials to ~/.connect-creds: do not have write permissions"}}`)
}

func (s *ResetCredsSuite) TestReset_UnknownError() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	// Unknown errors reach the surface,
	// reset proceeds, that is the reason we are resetting data.
	s.credsFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return s.credservice, errors.New("this is terrible")
	}

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusServiceUnavailable, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsServiceUnavailable"}`)
}

func (s *ResetCredsSuite) TestReset_ErrorWhileResetting() {
	path := "http://example.com/api/credentials"
	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	// Errors derived from resetting the data reach the surface.
	s.credservice.On("Reset").Return("", errors.New("this is terrible"))

	rec := httptest.NewRecorder()
	h := ResetCredentialsHandlerFunc(s.log, s.credsFactory)
	h(rec, req)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusServiceUnavailable, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"credentialsServiceUnavailable"}`)
}
