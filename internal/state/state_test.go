package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type StateSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.Path
}

func (s *StateSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func TestStateSuite(t *testing.T) {
	suite.Run(t, new(StateSuite))
}

func (s *StateSuite) TestEmpty() {
	state := Empty()
	s.NotNil(state.Account)
	s.NotNil(state.Config)
	s.Nil(state.Target)
}

func (s *StateSuite) createConfigFile(name string, bad bool) {
	configFile := config.GetConfigPath(s.cwd, name)
	configData := []byte(`
		'$schema' = 'https://example.com/schema/publishing.json'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'
		tags = ['a', 'b', 'c']

		[python]
		version = "3.11.3"
		package-manager = "pip"
		package-file = "requirements.txt"

		[environment]
		FOO = 'BAR'

		[connect.runtime]
		min-processes = 1
	`)

	if bad {
		configData = append(configData, []byte(`	unknown-field = value`)...)
	}
	err := configFile.WriteFile(configData, 0666)
	s.NoError(err)
}

func (s *StateSuite) TestLoadConfig() {
	s.createConfigFile("myConfig", false)
	cfg, err := loadConfig(s.cwd, "myConfig")
	s.NoError(err)
	min_procs := int32(1)

	s.Equal(&config.Config{
		Schema:      "https://example.com/schema/publishing.json",
		Type:        "python-dash",
		Entrypoint:  "app:app",
		Title:       "Super Title",
		Description: "minimal description",
		Tags:        []string{"a", "b", "c"},
		Python: &config.Python{Version: "3.11.3",
			PackageFile:    "requirements.txt",
			PackageManager: "pip",
		},
		Environment: map[string]string{
			"FOO": "BAR",
		},
		Connect: &config.Connect{
			Runtime: &config.ConnectRuntime{
				MinProcesses: &min_procs,
			},
		},
	}, cfg)
}

func (s *StateSuite) TestLoadConfigNonexistent() {
	cfg, err := loadConfig(s.cwd, "myConfig")
	s.ErrorContains(err, "can't find configuration")
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(cfg)
}

func (s *StateSuite) TestLoadConfigErr() {
	s.createConfigFile("myConfig", true)
	cfg, err := loadConfig(s.cwd, "myConfig")
	s.ErrorContains(err, "can't load file")
	s.Nil(cfg)
}

func (s *StateSuite) createTargetFile(name string, bad bool) {
	targetFile := deployment.GetLatestDeploymentPath(s.cwd, name)
	targetData := []byte(`
		'$schema' = 'https://example.com/schema/publishing-record.json'
		server-url = 'https://connect.example.com'
		server-type = "connect"
		id = '1234567890ABCDEF'
		configuration-name = "myConfig"
		files = [
			'app.py',
			'requirements.txt'
		]
		[configuration]
		'$schema' = 'https://example.com/schema/publishing.json'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'
		tags = ['a', 'b', 'c']

		[configuration.python]
		version = "3.11.3"
		package-manager = "pip"
		package-file = "requirements.txt"

		[configuration.environment]
		FOO = 'BAR'

		[configuration.connect.runtime]
		min-processes = 1
	`)

	if bad {
		targetData = append(targetData, []byte(`unknown-field = value`)...)
	}
	err := targetFile.WriteFile(targetData, 0666)
	s.NoError(err)
}

func (s *StateSuite) TestLoadTarget() {
	s.createTargetFile("myTarget", false)
	cfg, err := loadTarget(s.cwd, "myTarget")
	s.NoError(err)
	min_procs := int32(1)

	s.Equal(&deployment.Deployment{
		Schema:     "https://example.com/schema/publishing-record.json",
		ServerURL:  "https://connect.example.com",
		ServerType: "connect",
		ConfigName: "myConfig",
		Files: []string{
			"app.py",
			"requirements.txt",
		},
		Id: "1234567890ABCDEF",
		Configuration: config.Config{
			Schema:      "https://example.com/schema/publishing.json",
			Type:        "python-dash",
			Entrypoint:  "app:app",
			Title:       "Super Title",
			Description: "minimal description",
			Tags:        []string{"a", "b", "c"},
			Python: &config.Python{Version: "3.11.3",
				PackageFile:    "requirements.txt",
				PackageManager: "pip",
			},
			Environment: map[string]string{
				"FOO": "BAR",
			},
			Connect: &config.Connect{
				Runtime: &config.ConnectRuntime{
					MinProcesses: &min_procs,
				},
			},
		},
	}, cfg)
}

func (s *StateSuite) TestLoadTargetNonexistent() {
	cfg, err := loadTarget(s.cwd, "myTarget")
	fmt.Println(err)
	s.ErrorContains(err, "can't find deployment")
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(cfg)
}

func (s *StateSuite) TestLoadTargetErr() {
	s.createTargetFile("myTarget", true)
	cfg, err := loadTarget(s.cwd, "myTarget")
	s.ErrorContains(err, "can't load file")
	s.Nil(cfg)
}

func (s *StateSuite) TestLoadAccountByName() {
	accts := &accounts.MockAccountList{}
	expected := &accounts.Account{}
	accts.On("GetAccountByName", "myAccount").Return(expected, nil)
	actual, err := loadAccount("myAccount", accts)
	s.NoError(err)
	s.Equal(expected, actual)
}

func (s *StateSuite) TestLoadAccountByNameErr() {
	accts := &accounts.MockAccountList{}
	testErr := errors.New("test error from GetAccountByName")
	accts.On("GetAccountByName", "myAccount").Return(nil, testErr)
	actual, err := loadAccount("myAccount", accts)
	s.ErrorIs(err, testErr)
	s.Nil(actual)
}

func (s *StateSuite) TestLoadAccountNoAccounts() {
	accts := &accounts.MockAccountList{}
	accts.On("GetAllAccounts").Return(nil, nil)
	actual, err := loadAccount("", accts)
	s.NoError(err)
	s.Nil(actual)
}

func (s *StateSuite) TestLoadAccountErr() {
	accts := &accounts.MockAccountList{}
	testErr := errors.New("test error from GetAllAccounts")
	accts.On("GetAllAccounts").Return(nil, testErr)
	actual, err := loadAccount("", accts)
	s.ErrorIs(err, testErr)
	s.Nil(actual)
}

func (s *StateSuite) TestNewLocalID() {
	id, err := NewLocalID()
	s.NoError(err)
	s.NotEqual("", id)

	id2, err := NewLocalID()
	s.NoError(err)
	s.NotEqual("", id2)
	s.NotEqual(id, id2)
}

func (s *StateSuite) TestNew() {
	accts := &accounts.MockAccountList{}
	accts.On("GetAllAccounts").Return(nil, nil)

	configPath := config.GetConfigPath(s.cwd, "default")
	cfg := config.New()
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	state, err := New(s.cwd, "", "", "", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(state.AccountName, "")
	s.Equal(state.ConfigName, "")
	s.Equal(state.TargetID, "")
	s.Nil(state.Account, "")
	s.Equal(cfg, state.Config)
	s.Nil(state.Target)
}

func (s *StateSuite) TestNewConfigErr() {
	accts := &accounts.MockAccountList{}
	accts.On("GetAllAccounts").Return(nil, nil)

	state, err := New(s.cwd, "", "", "", accts)
	s.NotNil(err)
	s.ErrorContains(err, "couldn't load configuration")
	s.Nil(state)
}

func (s *StateSuite) TestNewWithTarget() {
	accts := &accounts.MockAccountList{}
	acct1 := accounts.Account{
		Name: "acct1",
		URL:  "https://saved.server.example.com",
	}
	acct2 := accounts.Account{
		Name: "acct2",
		URL:  "https://another.server.example.com",
	}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct1, acct2}, nil)
	accts.On("GetAccountByName", "acct1").Return(&acct1, nil)
	accts.On("GetAccountByName", "acct2").Return(&acct2, nil)
	accts.On("GetAccountByServerURL", "https://saved.server.example.com").Return(&acct1, nil)
	accts.On("GetAccountByServerURL", "https://another.server.example.com").Return(&acct2, nil)

	configPath := config.GetConfigPath(s.cwd, "savedConfigName")
	cfg := config.New()
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	targetPath := deployment.GetLatestDeploymentPath(s.cwd, "myTargetID")
	d := deployment.New()
	d.Id = "myTargetID"
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	err = d.WriteFile(targetPath)
	s.NoError(err)

	state, err := New(s.cwd, "", "", "myTargetID", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(state.AccountName, "acct1")
	s.Equal(state.ConfigName, "savedConfigName")
	s.Equal(state.TargetID, "myTargetID")
	s.Equal(state.Account, &acct1)
	s.Equal(state.Config, cfg)
	s.Equal(state.Target, d)
}

func (s *StateSuite) TestNewWithTargetAndAccount() {
	accts := &accounts.MockAccountList{}
	acct1 := accounts.Account{
		Name: "acct1",
		URL:  "https://saved.server.example.com",
	}
	acct2 := accounts.Account{
		Name: "acct2",
		URL:  "https://another.server.example.com",
	}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct1, acct2}, nil)
	accts.On("GetAccountByName", "acct1").Return(&acct1, nil)
	accts.On("GetAccountByName", "acct2").Return(&acct2, nil)
	accts.On("GetAccountByServerURL", "https://saved.server.example.com").Return(&acct1, nil)
	accts.On("GetAccountByServerURL", "https://another.server.example.com").Return(&acct2, nil)

	configPath := config.GetConfigPath(s.cwd, "savedConfigName")
	cfg := config.New()
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	targetPath := deployment.GetLatestDeploymentPath(s.cwd, "myTargetID")
	d := deployment.New()
	d.Id = "myTargetID"
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	err = d.WriteFile(targetPath)
	s.NoError(err)

	state, err := New(s.cwd, "acct2", "", "myTargetID", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(state.AccountName, "acct2")
	s.Equal(state.ConfigName, "savedConfigName")
	s.Equal(state.TargetID, "myTargetID")
	s.Equal(state.Account, &acct2)
	s.Equal(state.Config, cfg)
	s.Equal(state.Target, d)
}
