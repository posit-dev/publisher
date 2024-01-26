package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AccountEnvVarProviderSuite struct {
	utiltest.Suite
	envVarHelper utiltest.EnvVarHelper
}

func TestAccountEnvVarProviderSuite(t *testing.T) {
	suite.Run(t, new(AccountEnvVarProviderSuite))
}

func (s *AccountEnvVarProviderSuite) SetupTest() {
	s.envVarHelper.Setup("CONNECT_SERVER", "CONNECT_API_KEY", "CONNECT_INSECURE", "CONNECT_CERT")
}

func (s *AccountEnvVarProviderSuite) TeardownTest() {
	s.envVarHelper.Teardown()
}

func (s *AccountEnvVarProviderSuite) TestNewEnvVarProvider() {
	log := logging.New()
	provider := newEnvVarProvider(log)
	s.Equal(log, provider.log)
}

func (s *AccountEnvVarProviderSuite) TestLoadAll() {
	log := logging.New()
	provider := newEnvVarProvider(log)
	os.Setenv("CONNECT_SERVER", "https://connect.example.com:1234")
	os.Setenv("CONNECT_API_KEY", "0123456789ABCDEF0123456789ABCDEF")
	os.Setenv("CONNECT_INSECURE", "1")
	os.Setenv("CONNECT_CERT", "/etc/pki/certs/myca.crt")
	accountList, err := provider.Load()
	s.Nil(err)
	s.Equal([]Account{{
		ServerType:  ServerTypeConnect,
		AuthType:    AuthTypeAPIKey,
		Source:      AccountSourceEnvironment,
		Name:        "env",
		URL:         "https://connect.example.com:1234",
		Insecure:    true,
		Certificate: "/etc/pki/certs/myca.crt",
		ApiKey:      "0123456789ABCDEF0123456789ABCDEF",
	}}, accountList)
}

func (s *AccountEnvVarProviderSuite) TestLoadSome() {
	log := logging.New()
	provider := newEnvVarProvider(log)
	os.Setenv("CONNECT_SERVER", "https://connect.example.com:1234")
	accountList, err := provider.Load()
	s.Nil(err)
	s.Equal([]Account{{
		ServerType:  ServerTypeConnect,
		AuthType:    AuthTypeNone,
		Source:      AccountSourceEnvironment,
		Name:        "env",
		URL:         "https://connect.example.com:1234",
		Insecure:    false,
		Certificate: "",
		ApiKey:      "",
	}}, accountList)
}

func (s *AccountEnvVarProviderSuite) TestLoadNone() {
	log := logging.New()
	provider := newEnvVarProvider(log)
	accountList, err := provider.Load()
	s.Nil(err)
	s.Nil(accountList)
}

func (s *AccountEnvVarProviderSuite) normalizedUrlEquals(expected string, url string) {
	normalized, err := normalizeServerURL(url)
	s.NoError(err)
	s.Equal(expected, normalized)
}

func (s *AccountEnvVarProviderSuite) TestNormalizeServerURL() {
	s.normalizedUrlEquals("http://connect.example.com", "http://connect.example.com")
	s.normalizedUrlEquals("https://connect.example.com", "https://connect.example.com")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com/rsc")

	s.normalizedUrlEquals("https://connect.example.com", "https://CONNECT.example.com")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com:443/rsc")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com///rsc/")
}
