// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
)

type DeleteCredentialsSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestDeleteCredentialsSuite(t *testing.T) {
	suite.Run(t, new(DeleteCredentialsSuite))
}

func (s *DeleteCredentialsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *DeleteCredentialsSuite) SetupTest() {
	keyring.MockInit()
}

func (s *DeleteCredentialsSuite) Test204() {

	cs := credentials.CredentialsService{}
	cred, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)

	path, err := url.JoinPath("http://example.com/api/credentials/", cred.GUID)
	s.NoError(err)

	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	req = mux.SetURLVars(req, map[string]string{"guid": cred.GUID})

	rec := httptest.NewRecorder()
	h := DeleteCredentialHandlerFunc(s.log)
	h(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
}

func (s *DeleteCredentialsSuite) Test404() {
	path, err := url.JoinPath("http://example.com/api/credentials/", "example")
	s.NoError(err)

	req, err := http.NewRequest("DELETE", path, nil)
	s.NoError(err)

	req = mux.SetURLVars(req, map[string]string{"guid": "example"})

	rec := httptest.NewRecorder()
	h := DeleteCredentialHandlerFunc(s.log)
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
