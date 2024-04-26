package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os/exec"
	"runtime"
	"testing"

	"github.com/rstudio/connect-client/internal/executor/executortest"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
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

func (s *RSuite) TestNewRInspector() {
	log := logging.New()
	rPath := util.NewPath("/usr/bin/R", nil)
	i := NewRInspector(s.cwd, rPath, log)
	inspector := i.(*defaultRInspector)
	s.Equal(rPath, inspector.rExecutable)
	s.Equal(log, inspector.log)
}

const rOutput = `R version 4.3.0 (2023-04-21) -- "Already Tomorrow"
Copyright (C) 2023 The R Foundation for Statistical Computing
Platform: x86_64-apple-darwin20 (64-bit)

R is free software and comes with ABSOLUTELY NO WARRANTY.
You are welcome to redistribute it under the terms of the
GNU General Public License versions 2 or 3.
For more information about these matters see
https://www.gnu.org/licenses/.
`

func (s *RSuite) TestGetRVersionFromExecutable() {
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return([]byte(rOutput), nil, nil)
	inspector.executor = executor
	version, err := inspector.getRVersion(rPath.String())
	s.NoError(err)
	s.Equal("4.3.0", version)
}

func (s *RSuite) TestGetRVersionFromExecutableWindows() {
	// R on Windows emits version information on stderr
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return(nil, []byte(rOutput), nil)
	inspector.executor = executor
	version, err := inspector.getRVersion(rPath.String())
	s.NoError(err)
	s.Equal("4.3.0", version)
}

func (s *RSuite) TestGetRVersionFromExecutableErr() {
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	log := logging.New()
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	executor := executortest.NewMockExecutor()
	testError := errors.New("test error from RunCommand")
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return(nil, nil, testError)
	inspector.executor = executor
	version, err := inspector.getRVersion(rPath.String())
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *RSuite) TestGetRVersionFromRealDefaultR() {
	// This test can only run if R or R is on the PATH.
	rPath, err := exec.LookPath("R")
	if err != nil {
		s.T().Skip("This test requires R to be available on PATH")
	}
	log := logging.New()
	i := NewRInspector(s.cwd, util.Path{}, log)
	inspector := i.(*defaultRInspector)
	_, err = inspector.getRVersion(rPath)
	s.NoError(err)
}

func (s *RSuite) TestGetRenvLockfile() {
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	const getRenvLockOutput = "[1] \"/project/renv.lock\"\n"
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return([]byte(getRenvLockOutput), nil, nil)
	inspector.executor = executor
	lockfilePath, err := inspector.getRenvLockfile(rPath.String())
	s.NoError(err)
	expected := util.NewAbsolutePath("/project/renv.lock", nil).String()
	s.Equal(expected, lockfilePath.String())
}

const getRenvLockMismatchedOutput = `ℹ Using R 4.3.0 (lockfile was generated with R 3.6.3)
[1] "/project/renv.lock"
`

func (s *RSuite) TestGetRenvLockfileMismatchedVersion() {
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return([]byte(getRenvLockMismatchedOutput), nil, nil)
	inspector.executor = executor
	lockfilePath, err := inspector.getRenvLockfile(rPath.String())
	s.NoError(err)
	expected := util.NewAbsolutePath("/project/renv.lock", nil).String()
	s.Equal(expected, lockfilePath.String())
}

func (s *RSuite) TestGetRenvLockfileRExitCode() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	log := logging.New()
	rPath := util.NewPath("/usr/bin/false", nil)
	i := NewRInspector(s.cwd, rPath, log)
	inspector := i.(*defaultRInspector)

	// if the R call fails, we get back a default lockfile path
	lockfilePath, err := inspector.getRenvLockfile(rPath.String())
	s.NoError(err)
	s.Equal(s.cwd.Join("renv.lock").String(), lockfilePath.String())
}

func (s *RSuite) TestGetRenvLockfileRError() {
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	i := NewRInspector(s.cwd, rPath.Path, log)
	inspector := i.(*defaultRInspector)

	testError := errors.New("test error from RunCommand")
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rPath.String(), mock.Anything, mock.Anything).Return(nil, nil, testError)
	inspector.executor = executor
	lockfilePath, err := inspector.getRenvLockfile(rPath.String())
	s.ErrorIs(err, testError)
	s.Equal("", lockfilePath.String())
}

const lockFileContent = `{
	"R": {
	  "Version": "4.3.1",
	  "Repositories": [
		{
		  "Name": "CRAN",
		  "URL": "https://cloud.r-project.org"
		}
	  ]
	},
	"Packages": {}
}`

func (s *RSuite) TestGetRVersionFromLockFile() {
	log := logging.New()
	i := NewRInspector(s.cwd, util.Path{}, log)
	inspector := i.(*defaultRInspector)

	lockfilePath := s.cwd.Join("renv.lock")
	err := lockfilePath.WriteFile([]byte(lockFileContent), 0666)
	s.NoError(err)

	version, err := inspector.getRVersionFromLockfile(lockfilePath)
	s.NoError(err)
	s.Equal("4.3.1", version)
}

func (s *PythonSuite) TestGetRExecutable() {
	log := logging.New()
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "/some/R", mock.Anything, mock.Anything).Return(nil, nil, nil)
	i := &defaultRInspector{
		executor: executor,
		log:      log,
	}

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "R").Return("/some/R", nil)
	i.pathLooker = pathLooker
	executable, err := i.getRExecutable()
	s.NoError(err)
	s.Equal("/some/R", executable)
}

func (s *PythonSuite) TestGetRExecutableSpecifiedR() {
	log := logging.New()
	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "/some/R", mock.Anything, mock.Anything).Return(nil, nil, nil)
	i := &defaultRInspector{
		rExecutable: rPath.Path,
		executor:    executor,
		log:         log,
	}

	executable, err := i.getRExecutable()
	s.NoError(err)
	s.Equal(rPath.String(), executable)
}

func (s *PythonSuite) TestGetRExecutableSpecifiedRNotFound() {
	log := logging.New()

	i := NewRInspector(s.cwd, util.NewPath("/some/R", nil), log)
	inspector := i.(*defaultRInspector)

	executable, err := inspector.getRExecutable()
	s.ErrorIs(err, fs.ErrNotExist)
	s.Equal("", executable)
}

func (s *PythonSuite) TestGetRExecutableNotRunnable() {
	log := logging.New()

	testError := errors.New("test error from RunCommand")
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "/some/R", mock.Anything, mock.Anything).Return(nil, nil, testError)
	i := &defaultRInspector{
		executor: executor,
		log:      log,
	}

	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "R").Return("/some/R", nil)
	i.pathLooker = pathLooker

	executable, err := i.getRExecutable()
	s.ErrorIs(err, testError)
	s.Equal("", executable)
}
