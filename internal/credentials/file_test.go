// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"os"
	"runtime"
	"testing"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type FileCredentialsServiceSuite struct {
	utiltest.Suite
	testdata   util.AbsolutePath
	loggerMock *loggingtest.MockLogger
}

func TestFileCredentialsServiceSuite(t *testing.T) {
	suite.Run(t, new(FileCredentialsServiceSuite))
}

func (s *FileCredentialsServiceSuite) fileSetupDeleteTest() {
	fileData := []byte(`
[credentials.tokeep]
guid = "18cd5640-bee5-4b2a-992a-a2725ab6103d"
version = 0
url = "https://a1.connect-server:3939/connect"
api_key = "abcdeC2aqbh7dg8TO43XPu7r56YDh000"

[credentials.willdelete]
guid = "79077898-7e26-4909-9eb7-596d1a6d0b6f"
version = 0
url = "hTTps://b2.CONNECT-server:3939/connect"
api_key = "abcdeC2aqbh7dg8TO43XPu7r56YDh002"

[credentials.alsotokeep]
guid = "3bb375e4-6f01-4fd6-942a-ac32a5e4d7cc"
version = 0
url = "https://c3.connect-server:3939/connect"
api_key = "abcdeC2aqbh7dg8TO43XPu7r56YDh003"
`)

	err := os.WriteFile(s.testdata.Join("testdelete.toml").String(), fileData, 0644)
	s.NoError(err)
}

func (s *FileCredentialsServiceSuite) fileSetupNewCredsTest() {
	fileData := []byte(`
[credentials.preexistent]
guid = "18cd5640-bee5-4b2a-992a-a2725ab6103d"
version = 0
url = "https://a1.connect-server:3939/connect"
api_key = "abcdeC2aqbh7dg8TO43XPu7r56YDh000"
`)

	err := os.WriteFile(s.testdata.Join("testset.toml").String(), fileData, 0644)
	s.NoError(err)
}

func (s *FileCredentialsServiceSuite) SetupTest() {
	_, filename, _, ok := runtime.Caller(0)
	s.True(ok)
	dir := util.NewAbsolutePath(filename, nil).Dir()
	s.testdata = dir.Join("testdata", "toml")
	s.loggerMock = loggingtest.NewMockLogger()
	s.fileSetupDeleteTest()
	s.fileSetupNewCredsTest()
}

func (s *FileCredentialsServiceSuite) TestNewFileCredentialsService() {
	// Use an in memory filesystem for this test
	// avoiding to manipulate users ~/.connect-credentials
	fsys = afero.NewMemMapFs()
	defer func() { fsys = afero.NewOsFs() }()

	fcs, err := NewFileCredentialsService(s.loggerMock)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), fcs)

	expectedCredsPath, err := util.UserHomeDir(fsys)
	s.NoError(err)

	expectedCredsPath = expectedCredsPath.Join(".connect-credentials")
	s.Equal(fcs, &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: expectedCredsPath,
	})
}

func (s *FileCredentialsServiceSuite) TestSetupService() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("goodcreds.toml"),
	}

	err := cs.setup()
	s.NoError(err)
}

func (s *FileCredentialsServiceSuite) TestSetupService_FileNotExists() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("do-not-exist-must-create.toml"),
	}

	_, err := cs.credsFilepath.Stat()
	s.ErrorIs(err, os.ErrNotExist)

	err = cs.setup()
	s.NoError(err)

	_, err = cs.credsFilepath.Stat()
	s.NoError(err)

	// Delete file for, green field for test runs
	cs.credsFilepath.Remove()
	s.NoError(err)
}

func (s *FileCredentialsServiceSuite) TestLoadFile() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("goodcreds.toml"),
	}

	creds, err := cs.load()
	s.NoError(err)

	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"hugo": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
			"rick": {
				GUID:    "79077898-7e26-4909-9eb7-596d1a6d0b6f",
				Version: 0,
				URL:     "https://b2.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			},
			"jane": {
				GUID:    "3bb375e4-6f01-4fd6-942a-ac32a5e4d7cc",
				Version: 0,
				URL:     "https://c3.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh003",
			},
			"frank sinatra": {
				GUID:    "bcdd57dd-6a68-4dcc-9877-d3ab2f512a04",
				Version: 0,
				URL:     "https://c4.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh004",
			},
		},
	})
}

func (s *FileCredentialsServiceSuite) TestGet() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("goodcreds.toml"),
	}

	cred, err := cs.Get("79077898-7e26-4909-9eb7-596d1a6d0b6f")
	s.NoError(err)
	s.Equal(cred, &Credential{
		Name:   "rick",
		GUID:   "79077898-7e26-4909-9eb7-596d1a6d0b6f",
		URL:    "https://b2.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
	})
}

func (s *FileCredentialsServiceSuite) TestGet_CannotLoadErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("non-existent.toml"),
	}

	s.loggerMock.On("Debug", "Error loading credentials from file", "error", mock.Anything, "filename", cs.credsFilepath.String()).Return()

	_, err := cs.Get("79077898-7e26-4909-9eb7-596d1a6d0b6f")
	s.Error(err)
	s.loggerMock.AssertExpectations(s.T())
}

func (s *FileCredentialsServiceSuite) TestGet_NotFoundErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("goodcreds.toml"),
	}

	s.loggerMock.On("Debug", "Could not find credential in file", "error", mock.Anything, "filename", cs.credsFilepath.String()).Return()

	_, err := cs.Get("00000898-7e26-4909-9eb7-596d1a6d0b6f")
	s.Error(err)
	s.Equal(err.Error(), "credential not found: 00000898-7e26-4909-9eb7-596d1a6d0b6f")
	s.loggerMock.AssertExpectations(s.T())
}

func (s *FileCredentialsServiceSuite) TestList() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("goodcreds.toml"),
	}

	creds, err := cs.List()
	s.NoError(err)

	s.Contains(creds, Credential{
		Name:   "hugo",
		GUID:   "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		URL:    "https://a1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.Contains(creds, Credential{
		Name:   "rick",
		GUID:   "79077898-7e26-4909-9eb7-596d1a6d0b6f",
		URL:    "https://b2.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
	})
	s.Contains(creds, Credential{
		Name:   "jane",
		GUID:   "3bb375e4-6f01-4fd6-942a-ac32a5e4d7cc",
		URL:    "https://c3.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh003",
	})
	s.Contains(creds, Credential{
		Name:   "frank sinatra",
		GUID:   "bcdd57dd-6a68-4dcc-9877-d3ab2f512a04",
		URL:    "https://c4.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh004",
	})
}

func (s *FileCredentialsServiceSuite) TestList_CannotLoadErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("non-existent.toml"),
	}

	s.loggerMock.On("Debug", "Error loading credentials from file", "error", mock.Anything, "filename", cs.credsFilepath.String()).Return()

	_, err := cs.Get("79077898-7e26-4909-9eb7-596d1a6d0b6f")
	s.Error(err)
	s.loggerMock.AssertExpectations(s.T())
}

func (s *FileCredentialsServiceSuite) TestDelete() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("testdelete.toml"),
	}

	creds, err := cs.load()
	s.NoError(err)

	// Data generated on test setup
	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"tokeep": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
			"willdelete": {
				GUID:    "79077898-7e26-4909-9eb7-596d1a6d0b6f",
				Version: 0,
				URL:     "https://b2.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			},
			"alsotokeep": {
				GUID:    "3bb375e4-6f01-4fd6-942a-ac32a5e4d7cc",
				Version: 0,
				URL:     "https://c3.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh003",
			},
		},
	})

	err = cs.Delete("79077898-7e26-4909-9eb7-596d1a6d0b6f")
	s.NoError(err)

	creds, err = cs.load()
	s.NoError(err)

	// Data generated on test setup
	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"tokeep": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
			"alsotokeep": {
				GUID:    "3bb375e4-6f01-4fd6-942a-ac32a5e4d7cc",
				Version: 0,
				URL:     "https://c3.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh003",
			},
		},
	})
}

func (s *FileCredentialsServiceSuite) TestDelete_CannotLoadErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("non-existent.toml"),
	}

	s.loggerMock.On("Debug", "Cannot delete credential, error loading credentials from file", "error", mock.Anything, "filename", cs.credsFilepath.String()).Return()

	err := cs.Delete("79077898-7e26-4909-9eb7-596d1a6d0b6f")
	s.Error(err)
	s.loggerMock.AssertExpectations(s.T())
}

func (s *FileCredentialsServiceSuite) TestDelete_NotFoundErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("testdelete.toml"),
	}

	s.loggerMock.On("Debug", "Cannot delete credential that does not exist", "error", mock.Anything, "filename", cs.credsFilepath.String()).Return()

	err := cs.Delete("00000898-7e26-4909-9eb7-596d1a6d0b6f")
	s.Error(err)
	s.Equal(err.Error(), "credential not found: 00000898-7e26-4909-9eb7-596d1a6d0b6f")
	s.loggerMock.AssertExpectations(s.T())
}

func (s *FileCredentialsServiceSuite) TestSet() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("testset.toml"),
	}

	creds, err := cs.load()
	s.NoError(err)

	// Data generated on test setup
	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"preexistent": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
		},
	})

	newcred, err := cs.Set("newcred", "https://b2.connect-server:3939/connect", "abcdeC2aqbh7dg8TO43XPu7r56YDh002")
	s.NoError(err)

	s.Equal(newcred.Name, "newcred")
	s.Equal(newcred.URL, "https://b2.connect-server:3939/connect")
	s.Equal(newcred.ApiKey, "abcdeC2aqbh7dg8TO43XPu7r56YDh002")

	creds, err = cs.load()
	s.NoError(err)

	// Data generated on test setup
	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"preexistent": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
			"newcred": {
				GUID:    newcred.GUID,
				Version: 0,
				URL:     "https://b2.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			},
		},
	})

	newcred2, err := cs.Set("brand new cred wspaces", "https://b3.connect-server:3939/connect", "abcdeC2aqbh7dg8TO43XPu7r56YDh003")
	s.NoError(err)

	s.Equal(newcred2.Name, "brand new cred wspaces")
	s.Equal(newcred2.URL, "https://b3.connect-server:3939/connect")
	s.Equal(newcred2.ApiKey, "abcdeC2aqbh7dg8TO43XPu7r56YDh003")

	creds, err = cs.load()
	s.NoError(err)

	// Data generated on test setup
	s.Equal(creds, fileCredentials{
		Credentials: map[string]fileCredential{
			"preexistent": {
				GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
				Version: 0,
				URL:     "https://a1.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
			},
			"newcred": {
				GUID:    newcred.GUID,
				Version: 0,
				URL:     "https://b2.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			},
			"brand new cred wspaces": {
				GUID:    newcred2.GUID,
				Version: 0,
				URL:     "https://b3.connect-server:3939/connect",
				ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh003",
			},
		},
	})
}

func (s *FileCredentialsServiceSuite) TestSet_BlankDataErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("testset.toml"),
	}

	testCases := map[string][3]string{
		"empty credential": {"", "https://b2.connect-server:3939/connect", "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty URL":        {"newcred", "", "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty key":        {"newcred", "https://b2.connect-server:3939/connect", ""},
	}

	for _, params := range testCases {
		_, err := cs.Set(params[0], params[1], params[2])
		s.Error(err)
		s.Equal(err.Error(), "New credentials require non-empty Name, URL and Api Key fields")

		creds, err := cs.load()
		s.NoError(err)

		// File is intact
		s.Equal(creds, fileCredentials{
			Credentials: map[string]fileCredential{
				"preexistent": {
					GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
					Version: 0,
					URL:     "https://a1.connect-server:3939/connect",
					ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
				},
			},
		})
	}
}

func (s *FileCredentialsServiceSuite) TestSet_ConflictErr() {
	cs := &fileCredentialsService{
		log:           s.loggerMock,
		credsFilepath: s.testdata.Join("testset.toml"),
	}

	testCases := map[string][4]string{
		"conflict with Name": {
			"preexistent", "https://b2.connect-server:3939/connect", "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			"Name value conflicts with existing credential (preexistent) URL: https://a1.connect-server:3939/connect",
		},
		"conflict with URL": {
			"defanewnamehere", "https://a1.connect-server:3939/connect", "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
			"URL value conflicts with existing credential (preexistent) URL: https://a1.connect-server:3939/connect",
		},
	}

	for _, params := range testCases {
		expectedErrMessage := params[3]
		s.loggerMock.On("Debug", "Conflicts storing new credential to file", "error", expectedErrMessage, "filename", cs.credsFilepath.String()).Return()

		_, err := cs.Set(params[0], params[1], params[2])
		s.Error(err)
		s.loggerMock.AssertExpectations(s.T())

		creds, err := cs.load()
		s.NoError(err)

		// File is intact
		s.Equal(creds, fileCredentials{
			Credentials: map[string]fileCredential{
				"preexistent": {
					GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
					Version: 0,
					URL:     "https://a1.connect-server:3939/connect",
					ApiKey:  "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
				},
			},
		})
	}
}
