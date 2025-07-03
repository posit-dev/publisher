package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"testing"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type StateSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.AbsolutePath
	log logging.Logger
}

func (s *StateSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
	s.log = logging.New()
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
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json'
		server_type = 'connect'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'

		[python]
		version = "3.11.3"
		package_manager = "pip"
		package_file = "requirements.txt"

		[environment]
		FOO = 'BAR'

		[connect.runtime]
		min_processes = 1
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
		Schema:      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json",
		ServerType:  "connect",
		Type:        "python-dash",
		Entrypoint:  "app:app",
		Validate:    true,
		Files:       []string{},
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
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v4.json'
		server_url = 'https://connect.example.com'
		server_type = 'connect'
		id = '1234567890ABCDEF'
		dashboard_url = 'https://connect.example.com/connect/#/apps/1234567890ABCDEF'
		direct_url = 'https://connect.example.com/content/1234567890ABCDEF/'
		logs_url = 'https://connect.example.com/connect/#/apps/1234567890ABCDEF/logs'
		type = 'python-dash'
		configuration_name = "myConfig"
		files = [
			'app.py',
			'requirements.txt'
		]
		[configuration]
		'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json'
		server_type = 'connect'
		type = 'python-dash'
		entrypoint = 'app:app'
		title = 'Super Title'
		description = 'minimal description'
		validate = true

		[configuration.python]
		version = "3.11.3"
		package_manager = "pip"
		package_file = "requirements.txt"

		[configuration.environment]
		FOO = 'BAR'

		[configuration.connect.runtime]
		min_processes = 1
	`)

	if bad {
		targetData = append(targetData, []byte(`unknown-field = value`)...)
	}
	err := targetFile.WriteFile(targetData, 0666)
	s.NoError(err)
}

func (s *StateSuite) TestLoadTarget() {
	s.createTargetFile("myTarget", false)
	d, err := loadTarget(s.cwd, "myTarget")
	s.NoError(err)
	min_procs := int32(1)

	// Since we don't know the exact value of CreatedAt, skip it.
	s.NotEmpty(d.CreatedAt)
	d.CreatedAt = ""

	s.Equal(&deployment.Deployment{
		Schema:     "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v4.json",
		ServerURL:  "https://connect.example.com",
		ServerType: accounts.ServerTypeConnect,
		ConfigName: "myConfig",
		Type:       config.ContentTypePythonDash,
		CreatedAt:  "",
		Files: []string{
			"app.py",
			"requirements.txt",
		},
		ID:           "1234567890ABCDEF",
		DashboardURL: "https://connect.example.com/connect/#/apps/1234567890ABCDEF",
		DirectURL:    "https://connect.example.com/content/1234567890ABCDEF/",
		LogsURL:      "https://connect.example.com/connect/#/apps/1234567890ABCDEF/logs",
		Configuration: &config.Config{
			Schema:      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json",
			ServerType:  accounts.ServerTypeConnect,
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
	}, d)
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

func (s *StateSuite) makeConfiguration(name string, pythonConfig *config.Python, rConfig *config.R) *config.Config {
	path := config.GetConfigPath(s.cwd, name)
	cfg := config.New()
	cfg.ServerType = accounts.ServerTypeConnect
	cfg.Type = config.ContentTypeUnknown
	cfg.Entrypoint = "app.py"
	cfg.Python = pythonConfig
	cfg.R = rConfig
	err := cfg.WriteFile(path)
	s.NoError(err)
	r, err := config.FromFile(path)
	s.NoError(err)
	return r
}

func (s *StateSuite) makeConfigurationWithSecrets(name string, secrets []string) *config.Config {
	path := config.GetConfigPath(s.cwd, name)
	cfg := s.makeConfiguration(
		name,
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)
	cfg.Secrets = secrets
	err := cfg.WriteFile(path)
	s.NoError(err)
	return cfg
}

func (s *StateSuite) TestNew() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	cfg := s.makeConfiguration(
		"default",
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)
	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", "", "", "", accts, nil, false, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(state.AccountName, "")
	s.Equal(state.ConfigName, config.DefaultConfigName)
	s.Equal(state.TargetName, "")
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(map[string]string(nil), state.Secrets)
	s.Equal(state.Account.Insecure, false)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
}

func (s *StateSuite) TestNewNonDefaultConfig() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	cfg := s.makeConfiguration(
		configName,
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)
	insecure := true
	acct.Insecure = insecure

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", configName, "", "", accts, nil, insecure, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(state.Account.Insecure, true)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
}

func (s *StateSuite) TestNewConfigErr() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", "", "", "", accts, nil, false, mockRInterpreter, mockPythonInterpreter, s.log)
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

	cfg := s.makeConfiguration(
		"savedConfigName",
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)

	targetPath := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.ID = "myTargetName"

	d.DashboardURL = "https://connect.example.com/connect/#/apps/1234567890ABCDEF"
	d.DirectURL = "https://connect.example.com/content/1234567890ABCDEF/"
	d.LogsURL = "https://connect.example.com/connect/#/apps/1234567890ABCDEF/logs"
	d.Type = cfg.Type
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	d.Configuration = cfg
	_, err := d.WriteFile(targetPath, "", s.log)
	s.NoError(err)

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", "", "myTargetName", "", accts, nil, false, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("acct1", state.AccountName)
	s.Equal("savedConfigName", state.ConfigName)
	s.Equal("myTargetName", state.TargetName)
	s.Equal(&acct1, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(d, state.Target)
	s.Equal(state.Account.Insecure, false)
}

func (s *StateSuite) TestNewWithTargetAndAccount() {
	accts := &accounts.MockAccountList{}
	acct1 := accounts.Account{
		Name: "acct1",
		URL:  "https://saved.server.example.com",
	}
	acct2 := accounts.Account{
		Name: "acct2",
		URL:  "https://saved.server.example.com",
	}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct1, acct2}, nil)
	accts.On("GetAccountByName", "acct1").Return(&acct1, nil)
	accts.On("GetAccountByName", "acct2").Return(&acct2, nil)
	accts.On("GetAccountByServerURL", "https://saved.server.example.com").Return(&acct1, nil)

	cfg := s.makeConfiguration(
		"savedConfigName",
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)

	targetPath := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.ID = "myTargetName"
	d.DashboardURL = "https://connect.example.com/connect/#/apps/1234567890ABCDEF"
	d.DirectURL = "https://connect.example.com/content/1234567890ABCDEF/"
	d.LogsURL = "https://connect.example.com/connect/#/apps/1234567890ABCDEF/logs"
	d.ConfigName = "savedConfigName"
	d.ServerURL = "https://saved.server.example.com"
	d.Configuration = cfg
	_, err := d.WriteFile(targetPath, "", s.log)
	s.NoError(err)

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "acct2", "", "myTargetName", "mySaveName", accts, nil, false, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("acct2", state.AccountName)
	s.Equal("savedConfigName", state.ConfigName)
	s.Equal("myTargetName", state.TargetName)
	s.Equal(&acct2, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(d, state.Target)
}

func (s *StateSuite) TestNewWithSecrets() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)
	s.makeConfigurationWithSecrets("default", []string{"API_KEY", "DB_PASSWORD"})

	secrets := map[string]string{
		"API_KEY":     "secret123",
		"DB_PASSWORD": "password456",
	}

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", "", "", "", accts, secrets, false, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal(secrets, state.Secrets)
}

func (s *StateSuite) TestNewWithInvalidSecret() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)
	s.makeConfiguration(
		"default",
		&config.Python{
			Version:        "3.4.5",
			PackageManager: "pip",
			PackageFile:    "requirements.txt",
		},
		nil,
	)

	secrets := map[string]string{
		"INVALID_SECRET": "secret123",
	}

	mockRInterpreter := s.createMockRInterpreter()
	mockPythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", "", "", "", accts, secrets, false, mockRInterpreter, mockPythonInterpreter, s.log)
	s.NotNil(err)
	s.ErrorContains(err, "secret 'INVALID_SECRET' is not in the configuration")
	s.Nil(state)
}

func (s *StateSuite) createMockRInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(true)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("R", s.cwd.Fs()), nil)
	iMock.On("GetRVersion").Return("1.2.3", nil)
	relPath := util.NewRelativePath("renv.lock", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, true, nil)
	iMock.On("GetPackageManager").Return("renv")
	iMock.On("GetRRequires").Return("")
	return iMock
}

func (s *StateSuite) createMockRMissingInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	missingError := types.NewAgentError(types.ErrorRExecNotFound, errors.New("no r"), nil)
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(false)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetRVersion").Return("", missingError)
	relPath := util.NewRelativePath("", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, false, missingError)
	iMock.On("GetPackageManager").Return("renv")
	iMock.On("GetRRequires").Return("")
	return iMock
}

func (s *StateSuite) createMockPythonInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	iMock.On("IsPythonExecutableValid").Return(true)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("/bin/python", s.cwd.Fs()), nil)
	iMock.On("GetPythonVersion").Return("1.2.3", nil)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetPythonRequires").Return("")
	iMock.On("GetLockFilePath").Return("requirements.txt", true, nil)
	return iMock
}

func (s *StateSuite) createMockPythonMissingInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	missingError := types.NewAgentError(types.ErrorPythonExecNotFound, errors.New("no python"), nil)
	iMock.On("IsPythonExecutableValid").Return(false)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetPythonVersion").Return("", missingError)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetPythonRequires").Return("")
	iMock.On("GetLockFilePath").Return("", false, missingError)
	return iMock
}

func (s *StateSuite) TestNewWithInterpreterDefaultFillsNotNeeded() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	cfg := s.makeConfiguration(
		configName,
		&config.Python{
			Version:        "9.9.9",
			PackageManager: "my-pip",
			PackageFile:    "my-file.txt",
		},
		&config.R{
			Version:        "9.9.8",
			PackageManager: "my-renv",
			PackageFile:    "my-renv.lock",
		},
	)
	insecure := true
	acct.Insecure = insecure

	rInterpreter := s.createMockRInterpreter()
	pythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", configName, "", "", accts, nil, insecure, rInterpreter, pythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(state.Account.Insecure, true)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
}

func (s *StateSuite) TestNewWithInterpreterDefaultFillsNeeded() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	cfg := s.makeConfiguration(
		configName,
		&config.Python{},
		&config.R{},
	)
	insecure := true
	acct.Insecure = insecure

	rInterpreter := s.createMockRInterpreter()
	pythonInterpreter := s.createMockPythonInterpreter()

	// We expect that the New method will call these, so we'll call it ourselves
	// on our expected values
	cfg.R.FillDefaults(rInterpreter)
	cfg.Python.FillDefaults(pythonInterpreter)

	state, err := New(s.cwd, "", configName, "", "", accts, nil, insecure, rInterpreter, pythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(state.Account.Insecure, true)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
}

func (s *StateSuite) TestNewWithInterpreterDefaultFillsNeededButNoInterpreters() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	cfg := s.makeConfiguration(
		configName,
		&config.Python{},
		&config.R{},
	)
	insecure := true
	acct.Insecure = insecure

	// By having the interpreters not be valid, calling the Fill Defaults shouldn't modify anything
	rInterpreter := s.createMockRMissingInterpreter()
	pythonInterpreter := s.createMockPythonMissingInterpreter()

	state, err := New(s.cwd, "", configName, "", "", accts, nil, insecure, rInterpreter, pythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(state.Account.Insecure, true)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
}

func (s *StateSuite) TestNewWithInterpreterNoInterpreterSections() {
	accts := &accounts.MockAccountList{}
	acct := accounts.Account{}
	accts.On("GetAllAccounts").Return([]accounts.Account{acct}, nil)

	configName := "staging"
	cfg := s.makeConfiguration(
		configName,
		nil,
		nil,
	)
	insecure := true
	acct.Insecure = insecure

	// With interpreters set to nil, there should be no change to the sections
	rInterpreter := s.createMockRInterpreter()
	pythonInterpreter := s.createMockPythonInterpreter()

	state, err := New(s.cwd, "", configName, "", "", accts, nil, insecure, rInterpreter, pythonInterpreter, s.log)
	s.NoError(err)
	s.NotNil(state)
	s.Equal("", state.AccountName)
	s.Equal(configName, state.ConfigName)
	s.Equal("", state.TargetName)
	s.Equal(&acct, state.Account)
	s.Equal(cfg, state.Config)
	s.Equal(state.Account.Insecure, true)
	// Target is never nil. We create a new target if no target ID was provided.
	s.NotNil(state.Target)
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
