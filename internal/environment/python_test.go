package environment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/executor/executortest"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PythonSuite struct {
	utiltest.Suite
	cwd util.Path
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
	base := util.NewPath("/myproject", nil)
	pythonPath := util.NewPath("/usr/bin/python", nil)
	i := NewPythonInspector(base, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	s.Equal(base, inspector.base)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(log, inspector.log)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	i := NewPythonInspector(util.Path{}, pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.getPythonVersion()
	s.NoError(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	base := util.NewPath("/myproject", afero.NewMemMapFs())
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(base, pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	testError := errors.New("test error from RunCommand")
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return(nil, testError)
	inspector.executor = executor
	version, err := inspector.getPythonVersion()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *PythonSuite) TestGetPythonVersionFromPATH() {
	log := logging.New()
	i := NewPythonInspector(util.Path{}, util.Path{}, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.getPythonVersion()
	s.NoError(err)
	s.Equal("3.10.4", version)
	executor.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonVersionFromRealDefaultPython() {
	// This test can only run if python3 or python is on the PATH.
	_, err := exec.LookPath("python3")
	if err != nil {
		_, err := exec.LookPath("python")
		if err != nil {
			s.T().Skip("This test requires python or python3 to be available on PATH")
		}
	}
	log := logging.New()
	i := NewPythonInspector(util.Path{}, util.Path{}, log)
	inspector := i.(*defaultPythonInspector)
	version, err := inspector.getPythonVersion()
	s.NoError(err)
	s.True(strings.HasPrefix(version, "3."))
}

func (s *PythonSuite) TestGetPythonExecutableFallbackPython() {
	// python3 does not exist
	// python exists and is runnable
	log := logging.New()
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything).Return(nil, nil)
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
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything).Return(nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything).Return(nil, nil)

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
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything).Return(nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything).Return(nil, testError)

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

func (s *PythonSuite) TestEnsurePythonRequirementsFileWhenExists() {
	fileContent := []byte("numpy\npandas\n")
	reqPath := s.cwd.Join("requirements.txt")
	err := reqPath.WriteFile(fileContent, 0600)
	s.NoError(err)

	log := logging.New()
	i := NewPythonInspector(s.cwd, util.Path{}, log)
	inspector := i.(*defaultPythonInspector)

	filename, err := inspector.ensurePythonRequirementsFile()
	s.NoError(err)
	s.Equal("requirements.txt", filename)

	requirements, err := reqPath.ReadFile()
	s.NoError(err)
	s.Equal(fileContent, requirements)
}

func (s *PythonSuite) TestEnsurePythonRequirementsFileErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Stat")
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)
	base := util.NewPath("/anything", fs)
	log := logging.New()
	i := NewPythonInspector(base, util.Path{}, log)
	inspector := i.(*defaultPythonInspector)

	filename, err := inspector.ensurePythonRequirementsFile()
	s.Equal("", filename)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	fs.AssertExpectations(s.T())
}

func (s *PythonSuite) TestEnsurePythonRequirementsFileFromExecutable() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(s.cwd, pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := executortest.NewMockExecutor()
	freezeOutput := []byte("numpy\npandas\n")
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return(freezeOutput, nil)
	inspector.executor = executor

	filename, err := inspector.ensurePythonRequirementsFile()
	s.NoError(err)
	s.Equal("requirements.txt", filename)

	reqPath := s.cwd.Join("requirements.txt")
	requirements, err := reqPath.ReadFile()
	s.NoError(err)
	s.Equal(freezeOutput, requirements)
	executor.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutableErr() {
	log := logging.New()
	pythonPath := util.NewPath("/nonexistent/python3", nil)
	i := NewPythonInspector(s.cwd, pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	filename, err := inspector.ensurePythonRequirementsFile()
	s.Equal("", filename)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}
