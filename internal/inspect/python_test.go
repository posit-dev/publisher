package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"testing"

	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
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

	pythonVersionCache = make(map[string]string)
}

func (s *PythonSuite) TestNewPythonInspector() {
	log := logging.New()
	pythonPath := util.NewPath("/usr/bin/python", nil)
	i := NewPythonInspector(s.cwd, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(log, inspector.log)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	i := NewPythonInspector(s.cwd, pythonPath.Path, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil, nil)
	inspector.executor = executor
	version, err := inspector.getPythonVersion(pythonPath.String())
	s.NoError(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(s.cwd, pythonPath.Path, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	testError := errors.New("test error from RunCommand")
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)
	inspector.executor = executor
	version, err := inspector.getPythonVersion(pythonPath.String())
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *PythonSuite) TestGetPythonExecutableFallbackPython() {
	// python3 does not exist
	// python exists and is runnable
	log := logging.New()
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, nil)
	i := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python3").Return("", os.ErrNotExist)
	pathLooker.On("LookPath", "python").Return("/some/python", nil)
	i.pathLooker = pathLooker
	executable, err := i.getPythonExecutable()
	s.NoError(err)
	s.Equal("/some/python", executable)
}

func (s *PythonSuite) TestGetPythonExecutablePython3NotRunnable() {
	// python3 exists but is not runnable
	// python exists and is runnable
	log := logging.New()
	executor := executortest.NewMockExecutor()
	testError := errors.New("exit status 9009")
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, nil)

	i := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python3").Return("/some/python3", nil)
	pathLooker.On("LookPath", "python").Return("/some/python", nil)
	i.pathLooker = pathLooker
	executable, err := i.getPythonExecutable()
	s.NoError(err)
	s.Equal("/some/python", executable)
}

func (s *PythonSuite) TestGetPythonExecutableNoRunnablePython() {
	// python3 exists but is not runnable
	// python exists but is not runnable
	log := logging.New()
	executor := executortest.NewMockExecutor()
	testError := errors.New("exit status 9009")
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)

	i := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python3").Return("/some/python3", nil)
	pathLooker.On("LookPath", "python").Return("/some/python", nil)
	i.pathLooker = pathLooker
	executable, err := i.getPythonExecutable()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.ErrorContains(err, "could not run python executable")
	s.Equal("", executable)
}

func (s *PythonSuite) TestScanRequirements() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(s.cwd, pythonPath.Path, log)
	inspector := i.(*defaultPythonInspector)

	scanner := pydeps.NewMockDependencyScanner()
	specs := []*pydeps.PackageSpec{
		{Name: "numpy", Version: "1.26.1"},
		{Name: "pandas", Version: ""},
	}
	scanner.On("ScanDependencies", s.cwd, pythonPath.String()).Return(specs, nil)
	inspector.scanner = scanner

	reqs, python, err := inspector.ScanRequirements(s.cwd)
	s.NoError(err)
	s.Equal([]string{
		"numpy==1.26.1",
		"pandas",
	}, reqs)
	s.Equal(pythonPath.String(), python)
	scanner.AssertExpectations(s.T())
}

func (s *PythonSuite) TestReadRequirementsFile() {
	log := logging.New()
	i := NewPythonInspector(s.cwd, util.Path{}, log)

	filePath := s.cwd.Join("requirements.txt")
	filePath.WriteFile([]byte("# leading comment\nnumpy==1.26.1\n  \npandas\n    # indented comment\n"), 0777)

	reqs, err := i.ReadRequirementsFile(filePath)
	s.NoError(err)
	s.Equal([]string{
		"numpy==1.26.1",
		"pandas",
	}, reqs)
}
