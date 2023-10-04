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

func (s *PythonSuite) TestNewPythonInspector() {
	log := logging.New()
	projectDir := util.NewPath("/myproject", nil)
	pythonPath := util.NewPath("/usr/bin/python", nil)
	inspector := NewPythonInspector(projectDir, pythonPath, log)
	s.Equal(projectDir, inspector.projectDir)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(log, inspector.log)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	log := logging.New()
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	inspector := NewPythonInspector(util.Path{}, pythonPath, log)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	projectDir := util.NewPath("/myproject", afero.NewMemMapFs())
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	log := logging.New()
	inspector := NewPythonInspector(projectDir, pythonPath, log)
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
	inspector := NewPythonInspector(util.Path{}, util.Path{}, log)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", mock.Anything, mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
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
	s.Nil(err)
	s.True(strings.HasPrefix(version, "3."))
}

func (s *PythonSuite) TestGetPythonExecutableFallbackPython() {
	log := logging.New()
	inspector := NewPythonInspector(util.Path{}, util.Path{}, log)

	exec := util.NewMockPathLooker()
	exec.On("LookPath", "python3").Return("", os.ErrNotExist)
	exec.On("LookPath", "python").Return("/usr/bin/python", nil)
	executable, err := inspector.getPythonExecutable(exec)
	s.NoError(err)
	s.Equal("/usr/bin/python", executable)
}

func (s *PythonSuite) TestGetRequirementsFromFile() {
	baseDir, err := util.Getwd(afero.NewMemMapFs())
	s.Nil(err)
	err = baseDir.MkdirAll(0700)
	s.Nil(err)

	fileContent := []byte("numpy\npandas\n")
	reqPath := baseDir.Join("requirements.txt")
	err = reqPath.WriteFile(fileContent, 0600)
	s.Nil(err)

	log := logging.New()
	inspector := NewPythonInspector(baseDir, util.Path{}, log)
	requirements, err := inspector.GetPythonRequirements()
	s.Nil(err)
	s.Equal(fileContent, requirements)
}

func (s *PythonSuite) TestGetRequirementsFromFileErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Stat")
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)
	projectDir := util.NewPath("/anything", fs)
	log := logging.New()
	inspector := NewPythonInspector(projectDir, util.Path{}, log)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(requirements)
	fs.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutable() {
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	log := logging.New()
	inspector := NewPythonInspector(util.Path{}, pythonPath, log)
	executor := NewMockPythonExecutor()
	freezeOutput := []byte("numpy\npandas\n")
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return(freezeOutput, nil)
	inspector.executor = executor
	requirements, err := inspector.GetPythonRequirements()
	s.Nil(err)
	s.Equal(freezeOutput, requirements)
	executor.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutableErr() {
	log := logging.New()
	pythonPath := util.NewPath("/nonexistent/python3", nil)
	inspector := NewPythonInspector(util.Path{}, pythonPath, log)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(requirements)
}
