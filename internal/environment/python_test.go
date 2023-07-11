package environment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
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
	logger := rslog.NewDiscardingLogger()
	projectDir := util.NewPath("/myproject", nil)
	pythonPath := util.NewPath("/usr/bin/python", nil)
	inspector := NewPythonInspector(projectDir, pythonPath, logger)
	s.Equal(projectDir, inspector.projectDir)
	s.Equal(pythonPath, inspector.pythonPath)
	s.Equal(logger, inspector.logger)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	logger := rslog.NewDiscardingLogger()
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	inspector := NewPythonInspector(util.Path{}, pythonPath, logger)
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
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(projectDir, pythonPath, logger)
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
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(util.Path{}, util.Path{}, logger)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", "python3", mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.Equal("3.10.4", version)
	executor.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonVersionFromRealDefaultPython() {
	// This test can only run if python3 is on the PATH.
	_, err := exec.LookPath("python3")
	if err != nil {
		s.T().Skip("python3 isn't available on PATH")
	}
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(util.Path{}, util.Path{}, logger)
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.True(strings.HasPrefix(version, "3."))
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

	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(baseDir, util.Path{}, logger)
	requirements, err := inspector.GetPythonRequirements()
	s.Nil(err)
	s.Equal(fileContent, requirements)
}

func (s *PythonSuite) TestGetRequirementsFromFileErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Stat")
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)
	projectDir := util.NewPath("/anything", fs)
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(projectDir, util.Path{}, logger)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(requirements)
	fs.AssertExpectations(s.T())
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutable() {
	pythonPath := util.NewPath("/usr/bin/python3", nil)
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(util.Path{}, pythonPath, logger)
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
	logger := rslog.NewDiscardingLogger()
	pythonPath := util.NewPath("/nonexistent/python3", nil)
	inspector := NewPythonInspector(util.Path{}, pythonPath, logger)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(requirements)
}
