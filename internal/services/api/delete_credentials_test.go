package api

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/rstudio/connect-client/internal/credentials"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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

func (s *DeleteCredentialsSuite) Test202() {

	name := "test"
	cs := credentials.CredentialsService{}
	err := cs.Set(credentials.Credential{
		Name:   name,
		URL:    "http://example.com",
		ApiKey: "12345",
	})
	s.NoError(err)

	base, err := url.Parse(("http://example.com/api/credentials"))
	s.NoError(err)

	params := url.Values{}
	params.Add("name", name)
	base.RawQuery = params.Encode()

	req, err := http.NewRequest("DELETE", base.String(), nil)
	s.NoError(err)

	rec := httptest.NewRecorder()
	h := DeleteCredentialHandlerFunc(s.log)
	h(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}

func (s *DeleteCredentialsSuite) Test404() {
	base, err := url.Parse(("http://example.com/api/credentials"))
	s.NoError(err)

	name := "test"
	params := url.Values{}
	params.Add("name", name)
	base.RawQuery = params.Encode()

	req, err := http.NewRequest("DELETE", base.String(), nil)
	s.NoError(err)

	rec := httptest.NewRecorder()
	h := DeleteCredentialHandlerFunc(s.log)
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
