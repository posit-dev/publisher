package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type RSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestRSuite(t *testing.T) {
	suite.Run(t, new(RSuite))
}

func (s *RSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func setupNewRInterpreterMock(isValid bool, lockfileExist bool) interpreters.RInterpreter {
	i := interpreters.NewMockRInterpreter()

	i.On("IsRExecutableValid").Return(isValid)
	if isValid {
		i.On("GetRExecutable").Return(util.NewAbsolutePath("/bin/r", nil), nil)
	} else {
		i.On("GetRExecutable").Return(util.NewAbsolutePath("", nil), interpreters.MissingRError)
	}
	if isValid {
		i.On("GetRVersion").Return("1.2.3", nil)
	} else {
		i.On("GetRVersion").Return("", interpreters.MissingRError)
	}
	i.On("GetPackageManager").Return("renv")
	i.On("GetLockFilePath").Return(util.NewRelativePath("renv.lock", nil), lockfileExist, nil)
	return i
}

func (s *RSuite) TestNewRInspector() {
	log := logging.New()

	r := setupNewRInterpreterMock(true, true)

	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	inspector := i.(*defaultRInspector)
	s.Equal(s.cwd, inspector.base)
	s.Equal(log, inspector.log)
}

func (s *RSuite) TestInspectWithRFound() {
	r := setupNewRInterpreterMock(true, true)

	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	inspect, err := i.InspectR()
	s.NoError(err)
	s.Equal("renv", inspect.PackageManager)
	s.Equal("1.2.3", inspect.Version)
	s.Equal("renv.lock", inspect.PackageFile)
}

func (s *RSuite) TestInspectWithNoRFound() {
	r := setupNewRInterpreterMock(false, true)
	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	c, err := i.InspectR()
	s.NoError(err)
	s.Equal(&config.R{Version: "", PackageFile: "renv.lock", PackageManager: "renv"}, c)
}

func (s *RSuite) TestRequiresRWithEmptyCfgAndLockfileExists() {
	r := setupNewRInterpreterMock(true, true)

	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	cfg := &config.Config{}

	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(true, require)
}

func (s *RSuite) TestRequiresRWithEmptyCfgAndLockfileDoesNotExists() {
	r := setupNewRInterpreterMock(true, false)

	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	cfg := &config.Config{}

	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}

func (s *RSuite) TestRequiresRWithRCfg() {
	r := setupNewRInterpreterMock(true, true)
	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	cfg := &config.Config{
		R: &config.R{},
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(true, require)
}

func (s *RSuite) TestRequiresRNoRButWithTypeAsPython() {
	r := setupNewRInterpreterMock(true, true)
	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: config.ContentTypePythonFastAPI,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}

func (s *RSuite) TestRequiresRNoRButWithTypeEqualContentTypeHTML() {
	r := setupNewRInterpreterMock(true, true)

	log := logging.New()
	i, err := NewRInspector(s.cwd, &r, log, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: config.ContentTypeHTML,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}
