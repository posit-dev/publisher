package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"os"
	"runtime"
	"testing"

	"github.com/posit-dev/publisher/internal/executor/executortest"
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
	fs  afero.Fs
}

func MockExistsTrue(_ util.Path) (bool, error) {
	return true, nil
}

func MockExistsFalse(_ util.Path) (bool, error) {
	return false, nil
}

func MockExistsError(_ util.Path) (bool, error) {
	return false, errors.New("Error running Exist functionality")
}

func TestPythonSuite(t *testing.T) {
	suite.Run(t, new(PythonSuite))
}

func (s *PythonSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python3").Return("", os.ErrNotExist)
	pathLooker.On("LookPath", "python").Return("/some/python", nil)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil, nil)

	i, err := NewPythonInterpreter(s.cwd, pythonPath.Path, log, executor, pathLooker, MockExistsTrue)
	s.NoError(err)
	defaultPython := i.(*defaultPythonInterpreter)
	s.Equal("3.10.4", defaultPython.version)

	p, err := i.GetPythonExecutable()
	s.Nil(err)
	s.Equal(p.String(), defaultPython.pythonExecutable.String())
	v, err := i.GetPythonVersion()
	s.Nil(err)
	s.Equal(v, defaultPython.version)
}

func (s *PythonSuite) TestInvalidPythonWithInvalidPythonVersionFromExecutableErr() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python").Return("", os.ErrNotExist)
	pathLooker.On("LookPath", "python3").Return("/some/python3", nil)

	testError := errors.New("test error from RunCommand")
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)

	i, err := NewPythonInterpreter(s.cwd, pythonPath.Path, log, executor, pathLooker, MockExistsTrue)
	s.Nil(err)
	defaultPython := i.(*defaultPythonInterpreter)
	s.Equal("", defaultPython.pythonExecutable.String())
	s.Equal("", defaultPython.version)

	_, err = i.GetPythonExecutable()
	s.NotNil(err)
	_, err = i.GetPythonVersion()
	s.NotNil(err)
}

func (s *PythonSuite) TestGetPythonExecutableFallbackPython() {
	// python3 does not exist
	// python exists and is runnable
	log := logging.New()

	executor := executortest.NewMockExecutor()
	testError := errors.New("exit status 9009")
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil, nil)

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "python").Return("/some/python", nil)
	pathLooker.On("LookPath", "python3").Return("/some/python3", nil)

	i, err := NewPythonInterpreter(s.cwd, util.NewPath("", s.fs), log, executor, pathLooker, MockExistsTrue)
	s.NoError(err)
	defaultPython := i.(*defaultPythonInterpreter)
	if runtime.GOOS == "windows" {
		s.Equal("D:\\some\\python", defaultPython.pythonExecutable.String())
	} else {
		s.Equal("/some/python", defaultPython.pythonExecutable.String())
	}

	p, err := i.GetPythonExecutable()
	s.Nil(err)
	if runtime.GOOS == "windows" {
		s.Equal("D:\\some\\python", p.String())
	} else {
		s.Equal("/some/python", p.String())
	}
	v, err := i.GetPythonVersion()
	s.Nil(err)
	s.Equal("3.10.4", v)
}

func (s *PythonSuite) TestGetPythonExecutableNoRunnablePython() {
	// python3 exists but is not runnable
	// python exists but is not runnable
	log := logging.New()

	executor := executortest.NewMockExecutor()
	testError := errors.New("exit status 9009")
	executor.On("RunCommand", "/some/python3", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)
	executor.On("RunCommand", "/some/python", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, testError)

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "abc").Return("", os.ErrNotExist)
	pathLooker.On("LookPath", "python").Return("/some/python", nil)
	pathLooker.On("LookPath", "python3").Return("/some/python3", nil)

	i, err := NewPythonInterpreter(s.cwd, util.NewPath("abc", s.fs), log, executor, pathLooker, MockExistsTrue)
	s.NoError(err)

	p, err := i.GetPythonExecutable()
	aerr, isAerr := types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound)
	s.Equal(isAerr, true)
	s.Contains(aerr.Message, "Unable to detect any Python interpreters.")
	s.Equal("", p.String())

	v, err := i.GetPythonVersion()
	aerr, isAerr = types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound)
	s.Equal(isAerr, true)
	s.Contains(aerr.Message, "Unable to detect any Python interpreters.")
	s.Equal("", v)
}
