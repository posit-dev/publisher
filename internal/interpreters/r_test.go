package interpreters

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"runtime"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	fs  afero.Fs
}

func TestRSuite(t *testing.T) {
	suite.Run(t, new(RSuite))
}

func (s *RSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *RSuite) TestNewRInterpreter() {
	log := logging.New()
	rPath := util.NewPath("/usr/bin/R", s.fs)
	i := NewRInterpreter(s.cwd, rPath, log)
	interpreter := i.(*defaultRInterpreter)
	s.Equal(rPath, interpreter.preferredPath)
	s.Equal(log, interpreter.log)
	s.Equal("", interpreter.rExecutable.String())
	s.Equal("", interpreter.version)
	s.Equal("", interpreter.lockfileRelPath.String())
	s.Equal(false, interpreter.lockfileExists)
	s.Equal(false, interpreter.initialized)

	// New should return some failures for interface calls
	path, err := interpreter.GetRExecutable()
	s.Equal("", path.String())
	s.ErrorIs(err, NotYetInitialized)

	version, err := interpreter.GetRVersion()
	s.Equal("", version)
	s.ErrorIs(err, NotYetInitialized)

	lockFilePath, exists, err := interpreter.GetLockFilePath()
	s.Equal("", lockFilePath.String())
	s.Equal(false, exists)
	s.ErrorIs(err, NotYetInitialized)

	err = interpreter.CreateLockfile(util.NewAbsolutePath("abc/renv.lock", nil))
	s.ErrorIs(err, NotYetInitialized)
}

type OutputTestData struct {
	versionOutput        string
	expectedVersion      string
	pathsLockfileOutput  string
	expectedLockfilePath string
}

func getOutputTestData() []OutputTestData {
	data := []OutputTestData{
		// typical output from command `r --version`
		{`R version 4.3.0 (2023-04-21) -- "Already Tomorrow"
Copyright (C) 2023 The R Foundation for Statistical Computing
Platform: x86_64-apple-darwin20 (64-bit)

R is free software and comes with ABSOLUTELY NO WARRANTY.
You are welcome to redistribute it under the terms of the
GNU General Public License versions 2 or 3.
For more information about these matters see
https://www.gnu.org/licenses/.
`,
			"4.3.0",
			// success output from renv.lock
			`[1] "/Users/billsager/dev/publishing-client-another/test/sample-content/shinyapp/renv.lock"`,
			"../../test/sample-content/shinyapp/renv.lock",
		},
		// output when there is a warning
		{`WARNING: ignoring environment value of R_HOME
R version 4.3.3 (2024-02-29) -- "Angel Food Cake"
Copyright (C) 2024 The R Foundation for Statistical Computing
Platform: x86_64-apple-darwin20 (64-bit)

R is free software and comes with ABSOLUTELY NO WARRANTY.
You are welcome to redistribute it under the terms of the
GNU General Public License versions 2 or 3.
For more information about these matters see
https://www.gnu.org/licenses/.`,
			"4.3.3",
			// success output from renv.lock
			`[1] "/Users/billsager/dev/publishing-client-another/test/sample-content/shinyapp/renv.lock"`,
			"../../test/sample-content/shinyapp/renv.lock",
		},

		// output when there are multiple warnings
		// as well as closely matching version strings
		{`WARNING: ignoring environment value of R_HOME
WARNING: your mom is calling
WARNING: time to stand
Somewhere below is the correct R version 4.3.* that we're looking for
R version 4.3.3 (2024-02-29) -- "Angel Food Cake"
Copyright (C) 2024 The R Foundation for Statistical Computing
Platform: x86_64-apple-darwin20 (64-bit)

R is free software and comes with ABSOLUTELY NO WARRANTY.
You are welcome to redistribute it under the terms of the
GNU General Public License versions 2 or 3.
For more information about these matters see
https://www.gnu.org/licenses/.`,
			"4.3.3",
			// success output from renv.lock
			`[1] "/Users/billsager/dev/publishing-client-another/test/sample-content/shinyapp/renv.lock"`,
			"../../test/sample-content/shinyapp/renv.lock",
		},

		// test output where version exists in multiple locations
		// we want to get it from the first location
		{`
R version 4.3.3 (2024-02-29) -- "Angel Food Cake"
Copyright (C) 2024 The R Foundation for Statistical Computing
Platform: x86_64-apple-darwin20 (64-bit)
R version 4.1.1 (2023-12-29) -- "Fantasy Island"

R is free software and comes with ABSOLUTELY NO WARRANTY.
You are welcome to redistribute it under the terms of the
GNU General Public License versions 2 or 3.
For more information about these matters see
https://www.gnu.org/licenses/.`,
			"4.3.3",
			// success output from renv.lock
			`[1] "/Users/billsager/dev/publishing-client-another/test/sample-content/shinyapp/renv.lock"`,
			"../../test/sample-content/shinyapp/renv.lock",
		},
		// typical output from command `r --version`
		{`R version 4.3.0 (2023-04-21) -- "Already Tomorrow"
				Copyright (C) 2023 The R Foundation for Statistical Computing
				Platform: x86_64-apple-darwin20 (64-bit)
				
				R is free software and comes with ABSOLUTELY NO WARRANTY.
				You are welcome to redistribute it under the terms of the
				GNU General Public License versions 2 or 3.
				For more information about these matters see
				https://www.gnu.org/licenses/.
				`,
			"4.3.0",
			// error output from R regarding renv
			`Error in loadNamespace(x) : there is no package called ‘renv’"`,
			"renv.lock",
		},
	}
	return data
}

func (s *RSuite) TestGetRVersionFromExecutable() {
	for _, tc := range getOutputTestData() {
		s.SetupTest()
		log := logging.New()
		rPath := s.cwd.Join("bin", "R")
		rPath.Dir().MkdirAll(0777)
		rPath.WriteFile(nil, 0777)

		rInterpreter := NewRInterpreter(s.cwd, rPath.Path, log)
		executor := executortest.NewMockExecutor()
		executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return([]byte(tc.versionOutput), nil, nil)
		executor.On("RunCommand", mock.Anything, []string{"-s", "-e", "renv::paths$lockfile()"}, mock.Anything, mock.Anything).Return([]byte(tc.pathsLockfileOutput), nil, nil)

		interpreter := rInterpreter.(*defaultRInterpreter)
		interpreter.executor = executor
		err := rInterpreter.Init()
		s.NoError(err)

		rExecutable, err := rInterpreter.GetRExecutable()
		s.NoError(err)
		s.Equal(true, strings.Contains(rExecutable.String(), rPath.String()))

		version, err := rInterpreter.GetRVersion()
		s.NoError(err)
		s.Equal(tc.expectedVersion, version)

		lockFile, _, err := rInterpreter.GetLockFilePath()
		s.NoError(err)
		s.Equal(tc.expectedLockfilePath, lockFile.String())
	}
}

func (s *RSuite) TestGetRVersionFromExecutableWindows() {
	// R on Windows emits version information on stderr
	for _, tc := range getOutputTestData() {
		s.SetupTest()
		log := logging.New()
		rPath := s.cwd.Join("bin", "R")
		rPath.Dir().MkdirAll(0777)
		rPath.WriteFile(nil, 0777)
		rInterpreter := NewRInterpreter(s.cwd, rPath.Path, log)
		executor := executortest.NewMockExecutor()
		executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return(nil, []byte(tc.versionOutput), nil)
		executor.On("RunCommand", mock.Anything, []string{"-s", "-e", "renv::paths$lockfile()"}, mock.Anything, mock.Anything).Return(nil, []byte(tc.pathsLockfileOutput), nil)

		interpreter := rInterpreter.(*defaultRInterpreter)
		interpreter.executor = executor
		interpreter.fs = s.cwd.Fs()
		err := rInterpreter.Init()
		s.NoError(err)

		rExecutable, err := rInterpreter.GetRExecutable()
		s.NoError(err)
		s.Equal(true, strings.Contains(rExecutable.String(), rPath.String()))

		version, err := rInterpreter.GetRVersion()
		s.NoError(err)
		s.Equal(tc.expectedVersion, version)

		lockFile, _, err := rInterpreter.GetLockFilePath()
		s.NoError(err)
		s.Equal(tc.expectedLockfilePath, lockFile.String())
	}
}

type RExecutableValidTestData struct {
	initialized                      bool
	rExecutable                      util.AbsolutePath
	version                          string
	expectedIsRExecutableValidResult bool
}

func getRExecutableValidTestData(fs afero.Fs) []RExecutableValidTestData {
	data := []RExecutableValidTestData{
		{initialized: false, rExecutable: util.AbsolutePath{}, version: "", expectedIsRExecutableValidResult: false},
		{initialized: false, rExecutable: util.NewAbsolutePath("abc", fs), version: "", expectedIsRExecutableValidResult: false},
		{initialized: false, rExecutable: util.AbsolutePath{}, version: "1.2.3", expectedIsRExecutableValidResult: false},
		{initialized: true, rExecutable: util.NewAbsolutePath("abc", fs), version: "", expectedIsRExecutableValidResult: false},
		{initialized: true, rExecutable: util.AbsolutePath{}, version: "1.2.3", expectedIsRExecutableValidResult: false},
		{initialized: true, rExecutable: util.NewAbsolutePath("abc", fs), version: "1.2.3", expectedIsRExecutableValidResult: true},
	}
	return data
}

// Test some internal methods to confirm expected logic

// Make sure the combos don't allow a valid RExecutable to be wrongly reported
func (s *RSuite) TestIsRExecutableValid() {
	log := logging.New()
	i := NewRInterpreter(s.cwd, util.Path{}, log)
	interpreter := i.(*defaultRInterpreter)
	s.Equal(false, interpreter.IsRExecutableValid())

	interpreter.initialized = true
	interpreter.rExecutable = util.AbsolutePath{}
	for _, tc := range getRExecutableValidTestData(s.fs) {
		interpreter.initialized = tc.initialized
		interpreter.rExecutable = tc.rExecutable
		interpreter.version = tc.version
		s.Equal(tc.expectedIsRExecutableValidResult, interpreter.IsRExecutableValid())
	}
}

// Validate when we pass in a path that exists and is valid, we get it back
func (s *RSuite) TestResolveRExecutableWhenPassedInPathExistsAndIsValid() {
	log := logging.New()

	rPath := s.cwd.Join("bin", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile([]byte(nil), 0777)

	i := NewRInterpreter(s.cwd, rPath.Path, log)
	interpreter := i.(*defaultRInterpreter)
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return([]byte("R version 4.3.0 (2023-04-21)"), nil, nil)
	interpreter.executor = executor
	interpreter.initialized = true
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRExecutable()
	s.NoError(err)
	s.Equal(rPath.String(), interpreter.rExecutable.String())
	s.Equal("4.3.0", interpreter.version)
}

// Validate when we pass in a path that does not exist
// we fall through to pulling from PATH which exists and is valid
func (s *RSuite) TestResolveRExecutableWhenPassedInPathDoesNotExistButPathValid() {
	log := logging.New()

	// on path
	rPath := s.cwd.Join("some", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)
	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "R").Return(rPath.String(), nil)

	i := NewRInterpreter(s.cwd, util.NewPath("/bin/R2", s.cwd.Fs()), log)
	interpreter := i.(*defaultRInterpreter)
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return([]byte("R version 4.3.0 (2023-04-21)"), nil, nil)

	interpreter.executor = executor
	interpreter.initialized = true
	interpreter.pathLooker = pathLooker
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRExecutable()
	s.NoError(err)
	s.Equal(true, interpreter.IsRExecutableValid())
	s.Equal(rPath.String(), interpreter.rExecutable.String())
	s.Equal("4.3.0", interpreter.version)
}

// Validate when we pass in a path that exists but is not valid,
// we fail to find R
func (s *RSuite) TestResolveRExecutableWhenPassedInPathExistsButNotValid() {
	log := logging.New()

	// on path
	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "R").Return("/some/R", nil)
	rPath := s.cwd.Join("some", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)

	i := NewRInterpreter(s.cwd, util.NewPath(rPath.String(), s.cwd.Fs()), log)
	interpreter := i.(*defaultRInterpreter)
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return([]byte("bad command"), nil, nil)

	interpreter.executor = executor
	interpreter.initialized = true
	interpreter.pathLooker = pathLooker
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRExecutable()
	s.Error(err)
	s.Equal("couldn't parse R version from command output (/Users/billsager/dev/publishing-client-another/internal/interpreters/some/R --version)", err.Error())
	s.Equal(false, interpreter.IsRExecutableValid())
}

// Validate when we do not pass in a value and
// have R on the path that exists but is not valid
func (s *RSuite) TestResolveRExecutableWhenPathContainsRButNotValid() {
	log := logging.New()

	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	pathLooker := util.NewMockPathLooker()
	pathLooker.On("LookPath", "R").Return("/some/R", nil)
	rPath := s.cwd.Join("some", "R")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile([]byte(nil), 0777)

	i := NewRInterpreter(s.cwd, util.Path{}, log)
	interpreter := i.(*defaultRInterpreter)
	interpreter.pathLooker = pathLooker
	interpreter.initialized = true
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, []string{"--version"}, mock.Anything, mock.Anything).Return([]byte("Invalid stuff"), nil, nil)
	interpreter.executor = executor
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRExecutable()
	s.Error(err)
	s.Equal("unable to detect any R interpreters", err.Error())
}

// Validate that we find the lock file that R specifies
// with default name if it exists
func (s *RSuite) TestResolveRenvLockFileWithRSpecifyingDefaultNameAndExists() {
	log := logging.New()

	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	rPath := s.cwd.Join("renv.lock")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile(nil, 0777)

	i := NewRInterpreter(s.cwd, util.Path{}, log)
	interpreter := i.(*defaultRInterpreter)
	interpreter.initialized = true
	interpreter.fs = s.cwd.Fs()
	executor := executortest.NewMockExecutor()
	outputLine := fmt.Sprintf(`[1] "%s"`, rPath.String())
	executor.On("RunCommand", mock.Anything, []string{"-s", "-e", "renv::paths$lockfile()"}, mock.Anything, mock.Anything).Return([]byte(outputLine), nil, nil)
	interpreter.executor = executor

	err := interpreter.resolveRenvLockFile("does_not_matter")
	s.NoError(err)
	s.Equal("renv.lock", interpreter.lockfileRelPath.String())
	s.Equal(true, interpreter.lockfileExists)
}

// Validate that we don't find the lock file that R specifies
// with default name if it doesn't exist
func (s *RSuite) TestResolveRenvLockFileWithRSpecifyingDefaultNameAndDoesNotExist() {
	log := logging.New()

	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	i := NewRInterpreter(s.cwd, util.Path{}, log)
	interpreter := i.(*defaultRInterpreter)
	interpreter.initialized = true
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", mock.Anything, []string{"-s", "-e", "renv::paths$lockfile()"}, mock.Anything, mock.Anything).Return([]byte(`[1] "internal/interpreters/renv.lock"`), nil, nil)
	interpreter.executor = executor
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRenvLockFile("does_not_matter")
	s.NoError(err)
	s.Equal("internal/interpreters/renv.lock", interpreter.lockfileRelPath.String())
	s.Equal(false, interpreter.lockfileExists)
}

// Validate that we find the lock file that R specifies
// with special name if it exists
func (s *RSuite) TestResolveRenvLockFileWithRSpecialNameAndExists() {
	log := logging.New()

	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	rPath := s.cwd.Join("renv-project222.lock")
	rPath.Dir().MkdirAll(0777)
	rPath.WriteFile([]byte(nil), 0777)

	i := NewRInterpreter(s.cwd, util.Path{}, log)
	interpreter := i.(*defaultRInterpreter)
	executor := executortest.NewMockExecutor()
	outputLine := fmt.Sprintf(`[1] "%s"`, rPath.String())
	executor.On("RunCommand", mock.Anything, []string{"-s", "-e", "renv::paths$lockfile()"}, mock.Anything, mock.Anything).Return([]byte(outputLine), nil, nil)
	interpreter.executor = executor
	interpreter.fs = s.cwd.Fs()

	err := interpreter.resolveRenvLockFile("does_not_matter")
	s.NoError(err)
	s.Equal("renv-project222.lock", interpreter.lockfileRelPath.String())
	s.Equal(true, interpreter.lockfileExists)
}
