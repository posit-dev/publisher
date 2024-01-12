package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RsconnectPythonProviderSuite struct {
	utiltest.Suite
	envVarHelper utiltest.EnvVarHelper
	provider     *rsconnectPythonProvider
}

func setHome(home string) {
	if runtime.GOOS == "windows" {
		os.Setenv("USERPROFILE", home)
	} else {
		os.Setenv("HOME", home)
	}
}

func TestRsconnectPythonProviderSuite(t *testing.T) {
	suite.Run(t, new(RsconnectPythonProviderSuite))
}

func (s *RsconnectPythonProviderSuite) SetupSuite() {
	fs := utiltest.NewMockFs()
	log := logging.New()
	s.provider = newRSConnectPythonProvider(fs, log)
}

func (s *RsconnectPythonProviderSuite) SetupTest() {
	s.envVarHelper.Setup("HOME", "XDG_CONFIG_HOME", "USERPROFILE", "APPDATA")
}

func (s *RsconnectPythonProviderSuite) TeardownTest() {
	s.envVarHelper.Teardown()
}

func (s *RsconnectPythonProviderSuite) TestNewRSConnectPythonProvider() {
	log := logging.New()
	fs := utiltest.NewMockFs()
	provider := newRSConnectPythonProvider(fs, log)
	s.Equal(fs, provider.fs)
	s.Equal(log, provider.log)
}

func (s *RsconnectPythonProviderSuite) TestConfigDirNoHome() {
	dir, err := s.provider.configDir("linux")
	s.ErrorContains(err, "is not defined")
	s.Equal("", dir)
}

func (s *RsconnectPythonProviderSuite) TestConfigDirXdgConfig() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	setHome("/home/me")
	os.Setenv("XDG_CONFIG_HOME", "/home/myconfig")
	dir, err := s.provider.configDir("linux")
	s.Nil(err)
	s.Equal("/home/myconfig/rsconnect-python", dir)
}

func (s *RsconnectPythonProviderSuite) TestConfigDirLinux() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	setHome("/home/somebody")
	dir, err := s.provider.configDir("linux")
	s.Nil(err)
	s.Equal("/home/somebody/.rsconnect-python", dir)
}

func (s *RsconnectPythonProviderSuite) TestConfigDirMac() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	setHome("/Users/somebody")
	dir, err := s.provider.configDir("darwin")
	s.Nil(err)
	s.Equal("/Users/somebody/Library/Application Support/rsconnect-python", dir)
}

func (s *RsconnectPythonProviderSuite) TestConfigDirWindows() {
	setHome(`C:\Users\somebody`)
	os.Setenv("APPDATA", `C:\Users\somebody\AppData`)
	dir, err := s.provider.configDir("windows")
	s.Nil(err)
	s.Equal(filepath.Join(`C:\Users\somebody\AppData`, "rsconnect-python"), dir)
}

func (s *RsconnectPythonProviderSuite) TestServerListPath() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	setHome("/home/somebody")
	dir, err := s.provider.serverListPath("linux")
	s.Nil(err)
	s.Equal("/home/somebody/.rsconnect-python/servers.json", dir)
}

func (s *RsconnectPythonProviderSuite) TestServerListPathNoHome() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	dir, err := s.provider.serverListPath("linux")
	s.ErrorContains(err, "$HOME is not defined")
	s.Equal("", dir)
}

func (s *RsconnectPythonProviderSuite) TestDecodeServerStoreInvalidJSON() {
	data := []byte{}
	accounts, err := s.provider.decodeServerStore(data)
	s.NotNil(err)
	s.Nil(accounts)
}

func (s *RsconnectPythonProviderSuite) TestLoadNoHome() {
	accounts, err := s.provider.Load()
	s.NotNil(err)
	s.Nil(accounts)
}

func (s *RsconnectPythonProviderSuite) TestLoadNonexistentFile() {
	setHome("/home/me")
	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(nil, os.ErrNotExist)
	log := logging.New()
	provider := newRSConnectPythonProvider(fs, log)
	accounts, err := provider.Load()
	s.Nil(err)
	s.Nil(accounts)
}

func (s *RsconnectPythonProviderSuite) TestLoadFileError() {
	setHome("/home/me")
	testError := errors.New("kaboom!")
	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(nil, testError)
	log := logging.New()
	provider := newRSConnectPythonProvider(fs, log)
	accounts, err := provider.Load()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(accounts)
}

func (s *RsconnectPythonProviderSuite) TestLoadBadFile() {
	setHome("/home/me")
	fs := afero.NewMemMapFs()
	serverPath, err := s.provider.serverListPath(runtime.GOOS)
	s.Nil(err)
	err = afero.WriteFile(fs, serverPath, []byte{}, 0600)
	s.Nil(err)

	log := logging.New()
	provider := newRSConnectPythonProvider(fs, log)
	accounts, err := provider.Load()
	s.NotNil(err)
	s.Nil(accounts)
}

func (s *RsconnectPythonProviderSuite) TestLoad() {
	data := []byte(`{
		"local": {
			"name": "local",
			"url": "http://localhost:3939/",
			"api_key": "0123456789ABCDEF0123456789ABCDEF",
			"insecure": true,
			"ca_cert": null
		},
		"shinyapps": {
			"name": "shinyapps",
			"url": "https://api.shinyapps.io",
			"account_name": "mmarchetti1",
			"token": "0123456789ABCDEF",
			"secret": "FEDCBA9876543210"
		}
	}`)

	setHome("/home/me")
	serverPath, err := s.provider.serverListPath(runtime.GOOS)
	s.Nil(err)

	fs := afero.NewMemMapFs()
	err = afero.WriteFile(fs, serverPath, data, 0600)
	s.Nil(err)

	log := logging.New()
	provider := newRSConnectPythonProvider(fs, log)
	accounts, err := provider.Load()
	s.Nil(err)
	s.Equal([]Account{
		{
			ServerType: ServerTypeConnect,
			Source:     AccountSourceRsconnectPython,
			AuthType:   AuthTypeAPIKey,
			Name:       "local",
			URL:        "http://localhost:3939",
			Insecure:   true,
			ApiKey:     "0123456789ABCDEF0123456789ABCDEF",
		},
		{
			ServerType:  ServerTypeShinyappsIO,
			Source:      AccountSourceRsconnectPython,
			AuthType:    AuthTypeTokenSecret,
			Name:        "shinyapps",
			URL:         "https://api.shinyapps.io",
			AccountName: "mmarchetti1",
			Token:       "0123456789ABCDEF",
			Secret:      "FEDCBA9876543210",
		},
	}, accounts)
}
