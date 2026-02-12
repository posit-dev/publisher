package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

func (s *RSuite) TestNewRInspector() {
	log := logging.New()
	rPath := util.NewPath("/usr/bin/R", nil)

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		return i, nil
	}

	i, err := NewRInspector(s.cwd, rPath, log, setupMockRInterpreter, nil)
	s.NoError(err)

	inspector := i.(*defaultRInspector)
	s.Equal(s.cwd, inspector.base)
	s.Equal(log, inspector.log)
}

func (s *RSuite) TestInspectWithRFound() {
	var relPath util.RelativePath

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return(util.NewAbsolutePath("R", s.cwd.Fs()), nil)
		i.On("GetRVersion").Return("1.2.3", nil)
		relPath = util.NewRelativePath(s.cwd.Join("renv.lock").String(), s.cwd.Fs())
		i.On("GetLockFilePath").Return(relPath, true, nil)
		i.On("GetPackageManager").Return("renv")
		return i, nil
	}
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, setupMockRInterpreter, nil)
	s.NoError(err)

	inspect, err := i.InspectR()
	s.NoError(err)
	s.Equal("renv", inspect.PackageManager)
	s.Equal("1.2.3", inspect.Version)
	s.Equal(relPath.String(), inspect.PackageFile)
}

func (s *RSuite) TestInspectWithNoRFound() {
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		rExecNotFoundError := types.NewAgentError(types.ErrorRExecNotFound, errors.New("info"), nil)
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return(util.AbsolutePath{}, nil)
		i.On("GetRVersion").Return("", rExecNotFoundError)
		relPath := util.NewRelativePath(s.cwd.Join("renv_2222.lock").String(), s.cwd.Fs())
		i.On("GetLockFilePath").Return(relPath, false, nil)
		return i, nil
	}
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, setupMockRInterpreter, nil)
	s.NoError(err)

	inspect, err := i.InspectR()
	s.NoError(err)
	s.Equal("renv", inspect.PackageManager)
	s.Equal("", inspect.Version)
	s.Equal(s.cwd.Join("renv_2222.lock").String(), inspect.PackageFile)
}

func (s *RSuite) TestRequiresRWithEmptyCfgAndLockfileExists() {
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		relPath := util.NewRelativePath(s.cwd.Join("renv.lock").String(), s.cwd.Fs())
		i.On("GetLockFilePath").Return(relPath, true, nil)
		return i, nil
	}

	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, setupMockRInterpreter, nil)
	s.NoError(err)

	cfg := &config.Config{}

	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(true, require)
}

func (s *RSuite) TestRequiresRWithEmptyCfgAndLockfileDoesNotExists() {
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		relPath := util.NewRelativePath(s.cwd.Join("renv.lock").String(), s.cwd.Fs())
		i.On("GetLockFilePath").Return(relPath, false, nil)
		return i, nil
	}

	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, setupMockRInterpreter, nil)
	s.NoError(err)

	cfg := &config.Config{}

	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}

func (s *RSuite) TestRequiresRWithRCfg() {
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	cfg := &config.Config{
		R: &config.R{},
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(true, require)
}

func (s *RSuite) TestRequiresRNoRButWithTypeAsPython() {
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: contenttypes.ContentTypePythonFastAPI,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}

func (s *RSuite) TestRequiresRNoRButWithTypeEqualContentTypeHTML() {
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: contenttypes.ContentTypeHTML,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.Equal(false, require)
}

func (s *RSuite) TestRequiresRPythonWithRpy2() {
	// Create requirements.txt with rpy2
	reqFile := s.cwd.Join("requirements.txt")
	err := reqFile.WriteFile([]byte("numpy==1.26.1\nrpy2==3.5.0\npandas\n"), 0644)
	s.NoError(err)

	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: contenttypes.ContentTypePythonFastAPI,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.True(require, "Python content with rpy2 dependency should require R")
}

func (s *RSuite) TestRequiresRPythonWithoutRpy2() {
	// Create requirements.txt without rpy2
	reqFile := s.cwd.Join("requirements.txt")
	err := reqFile.WriteFile([]byte("numpy==1.26.1\npandas\n"), 0644)
	s.NoError(err)

	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	cfg := &config.Config{
		Type: contenttypes.ContentTypePythonFastAPI,
	}
	require, err := i.RequiresR(cfg)
	s.NoError(err)
	s.False(require, "Python content without rpy2 dependency should not require R")
}

func (s *RSuite) TestRequiresRPythonRpy2CheckError() {
	log := logging.New()
	i, err := NewRInspector(s.cwd, util.Path{}, log, nil, nil)
	s.NoError(err)

	// Inject a mock rpy2 checker that returns an error
	testErr := errors.New("failed to read requirements.txt")
	inspector := i.(*defaultRInspector)
	inspector.rpy2Checker = func(base util.AbsolutePath) (bool, error) {
		return false, testErr
	}

	cfg := &config.Config{
		Type: contenttypes.ContentTypePythonFastAPI,
	}
	require, err := i.RequiresR(cfg)
	s.ErrorIs(err, testErr, "RequiresR should propagate error from rpy2 check")
	s.False(require)
}

