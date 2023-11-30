package environment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"

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

func (m *MockPythonExecutor) runPythonCommand(pythonExecutable string, callArgs []string) ([]byte, error) {
	args := m.Called(pythonExecutable, callArgs)
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
	projectDir := util.NewPath("/myproject", nil)
	pythonPath := util.NewPath("/usr/bin/python", nil)
	i := NewPythonInspector(projectDir, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	s.Equal(projectDir, inspector.projectDir)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(log, inspector.log)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	i := NewPythonInspector(util.Path{}, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.NoError(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	projectDir := util.NewPath("/myproject", afero.NewMemMapFs())
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	log := logging.New()
	i := NewPythonInspector(projectDir, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	executor := NewMockPythonExecutor()
	testError := errors.New("test error from runPythonCommand")
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return(nil, testError)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *PythonSuite) TestGetPythonVersionFromPATH() {
	log := logging.New()
	i := NewPythonInspector(util.Path{}, util.Path{}, log)
	inspector := i.(*defaultPythonInspector)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
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
	inspector := NewPythonInspector(util.Path{}, util.Path{}, log)
	version, err := inspector.GetPythonVersion()
	s.NoError(err)
	s.True(strings.HasPrefix(version, "3."))
}

type mockPythonExecutor struct {
	mock.Mock
}

var _ pythonExecutor = &mockPythonExecutor{}

func (m *mockPythonExecutor) runPythonCommand(pythonExecutable string, args []string) ([]byte, error) {
	mockArgs := m.Called(pythonExecutable, args)
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
	executor.On("runPythonCommand", "/some/python", mock.Anything).Return(nil, nil)
	inspector := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	exec := util.NewMockPathLooker()
	exec.On("LookPath", "python3").Return("", os.ErrNotExist)
	exec.On("LookPath", "python").Return("/some/python", nil)
	executable, err := inspector.getPythonExecutable(exec)
	s.NoError(err)
	s.Equal("/some/python", executable)
}

func (s *PythonSuite) TestGetPythonExecutablePython3NotRunnable() {
	// python3 exists but is not runnable
	// python exists and is runnable
	log := logging.New()
	executor := &mockPythonExecutor{}
	testError := errors.New("exit status 9009")
	executor.On("runPythonCommand", "/some/python3", mock.Anything).Return(nil, testError)
	executor.On("runPythonCommand", "/some/python", mock.Anything).Return(nil, nil)

	inspector := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	exec := util.NewMockPathLooker()
	exec.On("LookPath", "python3").Return("/some/python3", nil)
	exec.On("LookPath", "python").Return("/some/python", nil)
	executable, err := inspector.getPythonExecutable(exec)
	s.NoError(err)
	s.Equal("/some/python", executable)
}

func (s *PythonSuite) TestGetPythonExecutableNoRunnablePython() {
	// python3 exists but is not runnable
	// python exists but is not runnable
	log := logging.New()
	executor := &mockPythonExecutor{}
	testError := errors.New("exit status 9009")
	executor.On("runPythonCommand", "/some/python3", mock.Anything).Return(nil, testError)
	executor.On("runPythonCommand", "/some/python", mock.Anything).Return(nil, testError)

	inspector := &defaultPythonInspector{
		executor: executor,
		log:      log,
	}

	exec := util.NewMockPathLooker()
	exec.On("LookPath", "python3").Return("/some/python3", nil)
	exec.On("LookPath", "python").Return("/some/python", nil)
	executable, err := inspector.getPythonExecutable(exec)
	s.NotNil(err)
	s.Equal("", executable)
}

func (s *PythonSuite) TestEnsurePythonRequirementsFileWhenExists() {
	fileContent := []byte("numpy\npandas\n")
	reqPath := s.cwd.Join("requirements.txt")
	err := reqPath.WriteFile(fileContent, 0600)
	s.NoError(err)

	log := logging.New()
	inspector := NewPythonInspector(s.cwd, util.Path{}, log)
	err = inspector.EnsurePythonRequirementsFile()
	s.NoError(err)

	requirements, err := reqPath.ReadFile()
	s.NoError(err)
	s.Equal(fileContent, requirements)
}

func (s *PythonSuite) TestEnsurePythonRequirementsFileErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Stat")
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)
	projectDir := util.NewPath("/anything", fs)
	log := logging.New()
	inspector := NewPythonInspector(projectDir, util.Path{}, log)
	err := inspector.EnsurePythonRequirementsFile()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	fs.AssertExpectations(s.T())
}

func (s *PythonSuite) TestEnsurePythonRequirementsFileFromExecutable() {
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	log := logging.New()
	i := NewPythonInspector(s.cwd, pythonPath, log)
	inspector := i.(*defaultPythonInspector)
	executor := NewMockPythonExecutor()
	freezeOutput := []byte("numpy\npandas\n")
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return(freezeOutput, nil)
	inspector.executor = executor
	err := inspector.EnsurePythonRequirementsFile()
	s.NoError(err)

	reqPath := s.cwd.Join("requirements.txt")
	requirements, err := reqPath.ReadFile()
	s.NoError(err)
	s.Equal(freezeOutput, requirements)
	executor.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutableErr() {
	log := logging.New()
	pythonPath := util.NewPath("/nonexistent/python3", nil)
	inspector := NewPythonInspector(s.cwd, pythonPath, log)
	err := inspector.EnsurePythonRequirementsFile()
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}
