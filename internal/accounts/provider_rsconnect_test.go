package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"runtime"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/dcf"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RsconnectProviderSuite struct {
	utiltest.Suite
	envVarHelper utiltest.EnvVarHelper
	provider     *rsconnectProvider
}

func TestRsconnectProviderSuite(t *testing.T) {
	suite.Run(t, new(RsconnectProviderSuite))
}

func (s *RsconnectProviderSuite) SetupSuite() {
	log := logging.New()
	fs := utiltest.NewMockFs()
	s.provider = newRSConnectProvider(fs, log)
}

func (s *RsconnectProviderSuite) SetupTest() {
	s.envVarHelper.Setup("HOME", "R_USER_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA")
}

func (s *RsconnectProviderSuite) TeardownTest() {
	s.envVarHelper.Teardown()
}

func (s *RsconnectProviderSuite) TestNewRSConnectProvider() {
	log := logging.New()
	fs := utiltest.NewMockFs()
	provider := newRSConnectProvider(fs, log)
	s.Equal(fs, provider.fs)
	s.Equal(log, provider.log)
}

func (s *RsconnectProviderSuite) TestConfigDirRUserConfig() {
	os.Setenv("R_USER_CONFIG_DIR", "/r/config")
	s.provider.goos = "linux"
	dir, err := s.provider.configDir()
	s.Nil(err)
	s.Equal("/r/config/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirXdgConfig() {
	os.Setenv("XDG_CONFIG_HOME", "/home/myconfig")
	s.provider.goos = "linux"
	dir, err := s.provider.configDir()
	s.Nil(err)
	s.Equal("/home/myconfig/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirLinux() {
	os.Setenv("HOME", "/home/somebody")
	s.provider.goos = "linux"
	dir, err := s.provider.configDir()
	s.Nil(err)
	s.Equal("/home/somebody/.config/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirLinuxNoHome() {
	s.provider.goos = "linux"
	dir, err := s.provider.configDir()
	s.ErrorContains(err, "$HOME is not defined")
	s.Equal("", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirMac() {
	os.Setenv("HOME", "/Users/somebody")
	s.provider.goos = "darwin"
	dir, err := s.provider.configDir()
	s.Nil(err)
	s.Equal("/Users/somebody/Library/Preferences/org.R-project.R/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirMacNoHome() {
	s.provider.goos = "darwin"
	dir, err := s.provider.configDir()
	s.ErrorContains(err, "$HOME is not defined")
	s.Equal("", dir.Path())
}

func (s *RsconnectProviderSuite) TestConfigDirWindows() {
	os.Setenv("APPDATA", `C:\Users\somebody\AppData`)
	s.provider.goos = "windows"
	dir, err := s.provider.configDir()
	s.Nil(err)
	s.Equal(`C:\Users\somebody\AppData/R/config/R/rsconnect`, dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirNoHome() {
	s.provider.goos = "linux"
	dir, err := s.provider.oldConfigDir()
	s.ErrorContains(err, "$HOME is not defined")
	s.Equal("", dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirRUserConfig() {
	os.Setenv("HOME", "/home/someuser")
	os.Setenv("R_USER_CONFIG_DIR", "/r/config")
	s.provider.goos = "linux"
	dir, err := s.provider.oldConfigDir()
	s.Nil(err)
	s.Equal("/r/config/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirXdgConfig() {
	os.Setenv("HOME", "/home/someuser")
	os.Setenv("XDG_CONFIG_HOME", "/home/myconfig")
	s.provider.goos = "linux"
	dir, err := s.provider.oldConfigDir()
	s.Nil(err)
	s.Equal("/home/myconfig/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirLinux() {
	os.Setenv("HOME", "/home/somebody")
	s.provider.goos = "linux"
	dir, err := s.provider.oldConfigDir()
	s.Nil(err)
	s.Equal("/home/somebody/.config/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirMac() {
	os.Setenv("HOME", "/Users/somebody")
	s.provider.goos = "darwin"
	dir, err := s.provider.oldConfigDir()
	s.Nil(err)
	s.Equal("/Users/somebody/Library/Application Support/R/rsconnect", dir.Path())
}

func (s *RsconnectProviderSuite) TestOldConfigDirWindows() {
	os.Setenv("HOME", `C:\Users\somebody`)
	// Using /Users here instead of C:\Users because when running
	// these tests on Mac/Linux, the call to Abs in oldConfigDir
	// does not recognize C:\Users as an absolute path.
	os.Setenv("APPDATA", `/Users\somebody\AppData\Roaming`)
	s.provider.goos = "windows"
	dir, err := s.provider.oldConfigDir()
	s.Nil(err)
	s.Equal(`/Users\somebody\AppData\Roaming/R/rsconnect`, dir.Path())
}

func (s *RsconnectProviderSuite) TestAccountsFromConfigShinyapps() {
	configServers := dcf.Records{{
		"name": "connect",
		"url":  "https://connect.example.com/__api__",
	}}
	configAccounts := dcf.Records{{
		"name":      "myaccount",
		"server":    "shinyapps.io",
		"userId":    "123",
		"accountId": "456",
		"token":     "0123456789ABCDEF",
		"secret":    "FEDCBA9876543210",
	}}
	accounts, err := s.provider.accountsFromConfig(configServers, configAccounts)
	s.Nil(err)
	s.Equal([]Account{{
		ServerType: ServerTypeShinyappsIO,
		Source:     AccountSourceRsconnect,
		AuthType:   AuthTypeTokenSecret,
		Name:       "shinyapps.io",
		URL:        "https://api.shinyapps.io",
		Token:      "0123456789ABCDEF",
		Secret:     "FEDCBA9876543210",
	}}, accounts)
}

func (s *RsconnectProviderSuite) TestAccountsFromConfigConnect() {
	configServers := dcf.Records{{
		"name": "connect.example.com",
		"url":  "https://connect.example.com/__api__",
	}}
	configAccounts := dcf.Records{{
		"username":    "rootUser",
		"accountId":   "1",
		"server":      "connect.example.com",
		"token":       "0123456789ABCDEF",
		"private_key": "FEDCBA9876543210",
	}}

	accounts, err := s.provider.accountsFromConfig(configServers, configAccounts)
	s.Nil(err)
	s.Equal([]Account{{
		ServerType:  ServerTypeConnect,
		Source:      AccountSourceRsconnect,
		AuthType:    AuthTypeTokenKey,
		Name:        "connect.example.com",
		URL:         "https://connect.example.com",
		AccountName: "rootUser",
		Token:       "0123456789ABCDEF",
		PrivateKey:  "FEDCBA9876543210",
	}}, accounts)
}

func (s *RsconnectProviderSuite) TestAccountsFromConfigNone() {
	configServers := dcf.Records{}
	configAccounts := dcf.Records{}

	accounts, err := s.provider.accountsFromConfig(configServers, configAccounts)
	s.Nil(err)
	s.Equal([]Account{}, accounts)
}

func (s *RsconnectProviderSuite) TestAccountsFromConfigMissingServer() {
	configServers := dcf.Records{}
	configAccounts := dcf.Records{{
		"username":    "rootUser",
		"accountId":   "1",
		"server":      "connect.example.com",
		"token":       "0123456789ABCDEF",
		"private_key": "FEDCBA9876543210",
	}}

	accounts, err := s.provider.accountsFromConfig(configServers, configAccounts)
	s.ErrorContains(err, "Account references nonexistent server name")
	s.Equal([]Account{}, accounts)
}

func (s *RsconnectProviderSuite) TestAccountsFromConfigMissingName() {
	configServers := dcf.Records{}
	configAccounts := dcf.Records{{
		"username": "rootUser",
	}}

	accounts, err := s.provider.accountsFromConfig(configServers, configAccounts)
	s.ErrorContains(err, "missing server name")
	s.Equal([]Account{}, accounts)
}

type RsconnectProviderLoadSuite struct {
	utiltest.Suite

	envVarHelper utiltest.EnvVarHelper
	provider     *rsconnectProvider
	fs           *utiltest.MockFs
	configDir    util.Path
	oldConfigDir util.Path
}

func TestRsconnectProviderLoadSuite(t *testing.T) {
	suite.Run(t, new(RsconnectProviderLoadSuite))
}

func (s *RsconnectProviderLoadSuite) SetupTest() {
	s.envVarHelper.Setup("HOME", "R_USER_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA")
	log := logging.New()
	s.fs = utiltest.NewMockFs()
	s.provider = newRSConnectProvider(s.fs, log)

	// Record some config paths so we don't need to keep inventing them
	var err error
	os.Setenv("HOME", "/home/someuser")
	s.configDir, err = s.provider.configDir()
	s.Nil(err)
	s.oldConfigDir, err = s.provider.oldConfigDir()
	s.Nil(err)
}

func (s *RsconnectProviderLoadSuite) TestLoadNewConfigDir() {
	fs := afero.NewMemMapFs()
	log := logging.New()
	provider := newRSConnectProvider(fs, log)
	configDir := util.NewPath(s.configDir.Path(), fs)
	s.loadUsingConfigDir(configDir, provider)
}

func (s *RsconnectProviderLoadSuite) TestLoadOldConfigDir() {
	fs := afero.NewMemMapFs()
	log := logging.New()
	provider := newRSConnectProvider(fs, log)
	oldConfigDir := util.NewPath(s.oldConfigDir.Path(), fs)
	s.loadUsingConfigDir(oldConfigDir, provider)
}

func (s *RsconnectProviderLoadSuite) loadUsingConfigDir(configDir util.Path, provider *rsconnectProvider) {
	serverDir := configDir.Join("servers")
	err := serverDir.MkdirAll(0600)
	s.Nil(err)

	connectServerPath := serverDir.Join("connect.example.com.dcf")
	connectServerData := []byte(
		`name: connect.example.com
url: https://connect.example.com/__api__
	`)

	err = connectServerPath.WriteFile(connectServerData, 0600)
	s.Nil(err)

	accountDir := configDir.Join("accounts")
	err = accountDir.MkdirAll(0600)
	s.Nil(err)

	connectAccountPath := accountDir.Join("connect.example.com", "rootUser.dcf")
	connectAccountData := []byte(
		`username: rootUser
accountId: 1
server: connect.example.com
token: 0123456789ABCDEF
private_key: FEDCBA9876543210
	`)
	err = connectAccountPath.WriteFile(connectAccountData, 0600)
	s.Nil(err)

	// shinyapps.io doesn't get a server file, just an account file

	shinyappsAccountPath := configDir.Join("accounts", "shinyapps.io", "myaccount.dcf")
	shinyappsAccountData := []byte(
		`name: myaccount
server: shinyapps.io
userId: 123
accountId: 456
token: 0123456789ABCDEF
secret: FEDCBA9876543210
	`)
	err = shinyappsAccountPath.WriteFile(shinyappsAccountData, 0600)
	s.Nil(err)
	accountList, err := provider.Load()
	s.Nil(err)
	s.Len(accountList, 2)
}

func (s *RsconnectProviderLoadSuite) TestLoadNoHome() {
	if runtime.GOOS == "windows" {
		// configDir passes on windows without HOME set
		s.T().Skip()
	}
	os.Unsetenv("HOME")
	accountList, err := s.provider.Load()
	s.NotNil(err)
	s.Nil(accountList)
}

func (s *RsconnectProviderLoadSuite) TestLoadOldConfigDirErr() {
	if s.configDir == s.oldConfigDir {
		// The mock calls will both return os.ErrNotExist so err will be nil.
		s.T().Skip()
	}
	testError := errors.New("stat error on oldConfigDir")
	s.fs.On("Stat", s.configDir.Path()).Return(utiltest.NewMockFileInfo(), os.ErrNotExist)
	s.fs.On("Stat", s.oldConfigDir.Path()).Return(utiltest.NewMockFileInfo(), testError)

	accountList, err := s.provider.Load()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(accountList)
}

func (s *RsconnectProviderLoadSuite) TestLoadNoOldConfigDir() {
	s.fs.On("Stat", s.configDir.Path()).Return(utiltest.NewMockFileInfo(), os.ErrNotExist)
	s.fs.On("Stat", s.oldConfigDir.Path()).Return(utiltest.NewMockFileInfo(), os.ErrNotExist)

	accountList, err := s.provider.Load()
	s.Nil(err)
	s.Nil(accountList)
}

func (s *RsconnectProviderLoadSuite) TestLoadServersFails() {
	dcfReader := dcf.NewMockFileReader()
	s.provider.dcfReader = dcfReader
	testError := errors.New("Fake DCF error")
	dcfReader.On("ReadFiles",
		mock.MatchedBy(func(p util.Path) bool {
			return strings.Contains(p.Path(), "servers")
		}), "*.dcf").Return(nil, testError)

	accountList, err := s.provider.loadFromConfigDir(s.configDir)
	s.ErrorIs(err, testError)
	s.Nil(accountList)
}

func (s *RsconnectProviderLoadSuite) TestLoadAccountsFails() {
	dcfReader := dcf.NewMockFileReader()
	s.provider.dcfReader = dcfReader
	testError := errors.New("Fake DCF error")
	dcfReader.On("ReadFiles",
		mock.MatchedBy(func(p util.Path) bool {
			return strings.Contains(p.Path(), "servers")
		}), "*.dcf").Return(nil, nil)
	dcfReader.On("ReadFiles",
		mock.MatchedBy(func(p util.Path) bool {
			return strings.Contains(p.Path(), "accounts")
		}), "*.dcf").Return(nil, testError)

	accountList, err := s.provider.loadFromConfigDir(s.configDir)
	s.ErrorIs(err, testError)
	s.Nil(accountList)
}

func (s *RsconnectProviderLoadSuite) TestLoadAccountsFromConfigFails() {
	dcfReader := dcf.NewMockFileReader()
	s.provider.dcfReader = dcfReader
	dcfReader.On("ReadFiles",
		mock.MatchedBy(func(p util.Path) bool {
			return strings.Contains(p.Path(), "servers")
		}), "*.dcf").Return(nil, nil)

	badAccounts := dcf.Records{{
		"server": "nonexistent",
	}}
	dcfReader.On("ReadFiles",
		mock.MatchedBy(func(p util.Path) bool {
			return strings.Contains(p.Path(), "accounts")
		}), "*.dcf").Return(badAccounts, nil)

	accountList, err := s.provider.loadFromConfigDir(s.configDir)
	s.NotNil(err)
	s.Nil(accountList)
}
