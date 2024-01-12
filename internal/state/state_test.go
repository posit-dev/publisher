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
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'

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
		Schema:      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		Type:        "python-dash",
		Entrypoint:  "app:app",
		Validate:    true,
		Title:       "Super Title",
		Description: "minimal description",
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
	s.ErrorContains(err, "unquoted string or incomplete number")
	s.Nil(cfg)
}

func (s *StateSuite) createTargetFile(name string, bad bool) {
	targetFile := deployment.GetDeploymentPath(s.cwd, name)
	targetData := []byte(`
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json'
		server-url = 'https://connect.example.com'
		server-type = "connect"
		id = '1234567890ABCDEF'
		configuration-name = "myConfig"
		files = [
			'app.py',
			'requirements.txt'
		]
		[configuration]
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'

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
		Schema:     "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json",
		ServerURL:  "https://connect.example.com",
		ServerType: "connect",
		ConfigName: "myConfig",
		Files: []string{
			"app.py",
			"requirements.txt",
		},
		ID:       "1234567890ABCDEF",
		SaveName: "myTarget",
		Configuration: config.Config{
			Schema:      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
			Type:        "python-dash",
			Entrypoint:  "app:app",
			Validate:    true,
			Title:       "Super Title",
			Description: "minimal description",
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
	s.ErrorContains(err, "unquoted string or incomplete number")
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
	s.ErrorIs(err, errNoAccounts)
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
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configPath := config.GetConfigPath(s.cwd, "default")
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	state, err := New(s.cwd, "", "", "", "", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(state.AccountName, "")
	s.Equal(state.ConfigName, config.DefaultConfigName)
	s.Equal(state.TargetName, "")
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Nil(state.Target)
}

func (s *StateSuite) TestNewNonDefaultConfig() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	state, err := New(s.cwd, "", configName, "", "", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Nil(state.Target)
}

func (s *StateSuite) TestNewConfigErr() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	state, err := New(s.cwd, "", "", "", "", accts)
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
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	targetPath := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.ID = "myTargetName"
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	d.Configuration = *cfg
	err = d.WriteFile(targetPath)
	s.NoError(err)

	state, err := New(s.cwd, "", "", "myTargetName", "", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("acct1", state.AccountName)
	s.Equal("savedConfigName", state.ConfigName)
	s.Equal("myTargetName", state.TargetName)
	s.Equal(&acct1, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(d, state.Target)
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
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	targetPath := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.ID = "myTargetName"
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	d.Configuration = *cfg
	err = d.WriteFile(targetPath)
	s.NoError(err)

	state, err := New(s.cwd, "acct2", "", "myTargetName", "mySaveName", accts)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("acct2", state.AccountName)
	s.Equal("savedConfigName", state.ConfigName)
	s.Equal("myTargetName", state.TargetName)
	s.Equal(&acct2, state.Account)
	s.Equal(cfg, state.Config)
	d.SaveName = "mySaveName"
	s.Equal(d, state.Target)
}

func (s *StateSuite) TestGetDefaultAccountNone() {
	actual, err := getDefaultAccount([]accounts.Account{})
	s.Nil(actual)
	s.ErrorIs(err, errNoAccounts)
}

func (s *StateSuite) TestGetDefaultAccountOne() {
	expected := accounts.Account{}
	actual, err := getDefaultAccount([]accounts.Account{expected})
	s.Equal(&expected, actual)
	s.NoError(err)
}

func (s *StateSuite) TestGetDefaultAccountFromEnv() {
	other := accounts.Account{}
	expected := accounts.Account{
		Source: accounts.AccountSourceEnvironment,
	}
	actual, err := getDefaultAccount([]accounts.Account{other, expected})
	s.Equal(&expected, actual)
	s.NoError(err)
}

func (s *StateSuite) TestGetDefaultAccountMultiple() {
	acct1 := accounts.Account{}
	acct2 := accounts.Account{}
	actual, err := getDefaultAccount([]accounts.Account{acct1, acct2})
	s.Nil(actual)
	s.ErrorIs(err, errMultipleAccounts)
}
