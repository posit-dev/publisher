package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PythonSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestPythonSuite(t *testing.T) {
	suite.Run(t, new(PythonSuite))
}

func (s *PythonSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *PythonSuite) TestNewPythonInspector() {
	log := logging.New()
	pythonPath := util.NewPath("/usr/bin/python", nil)

	setupMockPythonInterpreter := func(
		base util.AbsolutePath,
		pythonExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.PythonInterpreter, error) {
		i := interpreters.NewMockPythonInterpreter()
		i.On("Init").Return(nil)
		return i, nil
	}

	_, err := NewPythonInspector(s.cwd, pythonPath, log, setupMockPythonInterpreter, nil)
	s.NoError(err)
}

func (s *PythonSuite) TestScanRequirements() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()

	setupMockPythonInterpreter := func(
		base util.AbsolutePath,
		pythonExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.PythonInterpreter, error) {
		i := interpreters.NewMockPythonInterpreter()
		i.On("IsPythonExecutableValid").Return(true)
		i.On("GetPythonExecutable").Return(pythonPath, nil)
		i.On("GetPythonVersion").Return("1.2.3", nil)
		return i, nil
	}

	i, err := NewPythonInspector(s.cwd, pythonPath.Path, log, setupMockPythonInterpreter, nil)
	s.NoError(err)
	inspector := i.(*defaultPythonInspector)

	scanner := pydeps.NewMockDependencyScanner()
	specs := []*pydeps.PackageSpec{
		{Name: "numpy", Version: "1.26.1"},
		{Name: "pandas", Version: ""},
	}
	scanner.On("ScanDependencies", s.cwd, mock.Anything).Return(specs, nil)
	inspector.scanner = scanner

	reqs, incomplete, python, err := inspector.ScanRequirements(s.cwd)
	s.NoError(err)
	s.Equal([]string{
		"numpy==1.26.1",
		"pandas",
	}, reqs)
	s.Equal([]string{
		"pandas",
	}, incomplete)
	s.Equal(pythonPath.String(), python)
	scanner.AssertExpectations(s.T())
}

func (s *PythonSuite) TestInspectPython_PythonNotAvailable() {
	log := logging.New()
	pathLooker := util.NewMockPathLooker()

	setupMockPythonInterpreter := func(
		base util.AbsolutePath,
		pythonExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.PythonInterpreter, error) {
		i := interpreters.NewMockPythonInterpreter()
		i.On("IsPythonExecutableValid").Return(false)
		i.On("GetPythonExecutable").Return(util.AbsolutePath{}, interpreters.MissingPythonError)
		i.On("GetPythonVersion").Return("", interpreters.MissingPythonError)
		return i, nil
	}

	// Using .Join() to create the path for cross-platform compatibility tests
	pythonPath := util.NewPath("", nil)
	pythonPath = pythonPath.Join("usr", "bin", "pythontonotbefound")
	i, err := NewPythonInspector(s.cwd, pythonPath, log, setupMockPythonInterpreter, nil)
	s.NoError(err)
	inspector := i.(*defaultPythonInspector)
	inspector.pathLooker = pathLooker

	_, err = inspector.InspectPython()
	s.NotNil(err)

	_, isAerr := types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound)
	s.Equal(isAerr, true)
}

func (s *PythonSuite) TestRequiresPython() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()

	setupMockPythonInterpreter := func(
		base util.AbsolutePath,
		pythonExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride util.ExistsFunc,
	) (interpreters.PythonInterpreter, error) {
		i := interpreters.NewMockPythonInterpreter()
		i.On("IsPythonExecutableValid").Return(true)
		i.On("GetPythonExecutable").Return(pythonPath, nil)
		i.On("GetPythonVersion").Return("1.2.3", nil)
		return i, nil
	}

	i, err := NewPythonInspector(s.cwd, pythonPath.Path, log, setupMockPythonInterpreter, nil)
	s.NoError(err)

	// We have a section with an empty version
	pythonSectionWithVersion := &config.Config{
		Python: &config.Python{
			Version: "",
		},
	}
	result, err := i.RequiresPython(pythonSectionWithVersion)
	s.NoError(err)
	s.Equal(true, result)

	// We have no Python section and there is no requirements.txt file
	noPythonSection := &config.Config{}
	result, err = i.RequiresPython(noPythonSection)
	s.NoError(err)
	s.Equal(false, result)

	// create a requirements.txt file
	// Test requirements.txt exists
	filePath := s.cwd.Join("requirements.txt")
	filePath.WriteFile([]byte("# leading comment\nnumpy==1.26.1\n  \npandas\n    # indented comment\n"), 0777)

	// We have no Python section and there is a requirements.txt file
	result, err = i.RequiresPython(noPythonSection)
	s.NoError(err)
	s.Equal(true, result)
}
