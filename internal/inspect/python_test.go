package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/inspect/dependencies/pydeps"
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

type MockPythonExecutor struct {
	mock.Mock
}

func (m *MockPythonExecutor) RunCommand(pythonExecutable string, callArgs []string, log logging.Logger) ([]byte, error) {
	args := m.Called(pythonExecutable, callArgs, log)
	data := args.Get(0)
	if data == nil {
		return nil, args.Error(1)
	} else {
		return data.([]byte), args.Error(1)
	}
}

func NewMockPythonExecutor() *MockPythonExecutor {
	return &MockPythonExecutor{}
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
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(log, inspector.log)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := NewMockPythonExecutor()
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.getPythonVersionFromExecutable()
	s.NoError(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := NewMockPythonExecutor()
	testError := errors.New("test error from RunCommand")
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return(nil, testError)
	inspector.executor = executor
	version, err := inspector.getPythonVersionFromExecutable()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *PythonSuite) TestGetPythonVersionFromPATH() {
	log := logging.New()
	i := NewPythonInspector(util.Path{}, log)
	inspector := i.(*defaultPythonInspector)

	executor := NewMockPythonExecutor()
	executor.On("RunCommand", mock.Anything, mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.getPythonVersionFromExecutable()
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
	i := NewPythonInspector(util.Path{}, log)
	inspector := i.(*defaultPythonInspector)
	version, err := inspector.getPythonVersionFromExecutable()
	s.NoError(err)
	s.True(strings.HasPrefix(version, "3."))
}

func (s *PythonSuite) TestGetPythonVersionFromFile() {
	log := logging.New()
	i := NewPythonInspector(util.Path{}, log)

	err := s.cwd.Join(".python-version").WriteFile([]byte("3.9"), 0666)
	s.NoError(err)

	pyConfig, err := i.InspectPython(s.cwd)
	s.NoError(err)
	s.Equal("3.9.0", pyConfig.Version)
}

func (s *PythonSuite) TestGetPythonVersionFromParentDirFile() {
	log := logging.New()
	i := NewPythonInspector(util.Path{}, log)

	err := s.cwd.Join(".python-version").WriteFile([]byte("3.9"), 0666)
	s.NoError(err)

	subdir := s.cwd.Join("subdir")
	err = subdir.Mkdir(0777)
	s.NoError(err)

	pyConfig, err := i.InspectPython(subdir)
	s.NoError(err)
	s.Equal("3.9.0", pyConfig.Version)
}

func (s *PythonSuite) TestGetPythonVersionFromFileNonexistent() {
	log := logging.New()
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	executor := NewMockPythonExecutor()
	executor.On("RunCommand", pythonPath.String(), mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor

	pyConfig, err := i.InspectPython(s.cwd)
	s.NoError(err)
	s.Equal("3.10.4", pyConfig.Version)
}

type mockPythonExecutor struct {
	mock.Mock
}

var _ executor.Executor = &mockPythonExecutor{}

func (m *mockPythonExecutor) RunCommand(pythonExecutable string, args []string, log logging.Logger) ([]byte, error) {
	mockArgs := m.Called(pythonExecutable, args, log)
	out := mockArgs.Get(0)
	if out != nil {
		return out.([]byte), mockArgs.Error(1)
	} else {
		return nil, mockArgs.Error(1)
	}
}

func (s *PythonSuite) TestGetPythonExecutableFallbackPython() {
	// python3 does not exist
	// python exists and is runnable
	log := logging.New()
	executor := &mockPythonExecutor{}
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
	executor := &mockPythonExecutor{}
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
	executor := &mockPythonExecutor{}
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

func (s *PythonSuite) TestCreateRequirementsFileFromExecutable() {
	pythonPath := s.cwd.Join("bin", "python3")
	pythonPath.Dir().MkdirAll(0777)
	pythonPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	scanner := pydeps.NewMockDependencyScanner()
	specs := []*pydeps.PackageSpec{
		{Name: "numpy", Version: "1.26.1"},
		{Name: "pandas", Version: ""},
	}
	scanner.On("ScanDependencies", s.cwd, pythonPath.String()).Return(specs, nil)
	inspector.scanner = scanner

	err := inspector.CreateRequirementsFile(s.cwd, s.cwd.Join(bundles.PythonRequirementsFilename))
	s.NoError(err)

	reqPath := s.cwd.Join("requirements.txt")
	requirements, err := reqPath.ReadFile()
	s.NoError(err)
	s.Equal([]byte("numpy==1.26.1\npandas\n"), requirements)
	scanner.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutableErr() {
	log := logging.New()
	pythonPath := util.NewPath("/nonexistent/python3", nil)
	i := NewPythonInspector(pythonPath, log)
	inspector := i.(*defaultPythonInspector)

	err := inspector.CreateRequirementsFile(s.cwd, s.cwd.Join(bundles.PythonRequirementsFilename))
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}
