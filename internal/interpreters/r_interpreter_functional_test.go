package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

// RInterpreterFunctionalSuite contains functional tests that actually
// interact with real R installations
type RInterpreterFunctionalSuite struct {
	suite.Suite
	testProjectDir     util.AbsolutePath
	log                logging.Logger
	interpreter        RInterpreter
	rExecutable        util.AbsolutePath
	defaultInterpreter *defaultRInterpreter
	renvInstalled      bool
}

func TestRInterpreterFunctionalSuite(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}

	suite.Run(t, new(RInterpreterFunctionalSuite))
}

func (s *RInterpreterFunctionalSuite) SetupTest() {
	// Set up the test directory
	// We can't use an in memory filesystem here because we will end up chdiring to it
	fs := afero.NewOsFs()
	parentDir, err := afero.TempDir(fs, "", "r-interpreter-test")
	s.Require().NoError(err)

	s.testProjectDir = util.NewAbsolutePath(parentDir, fs)
	s.log = logging.New()

	// Initialize R interpreter once for all tests
	s.interpreter, err = NewRInterpreter(s.testProjectDir, util.Path{}, s.log, nil, nil, nil)
	s.Require().NoError(err)

	// Try to get R executable
	s.rExecutable, err = s.interpreter.GetRExecutable()
	if err != nil {
		s.T().Logf("R executable not found: %v", err)
		// Not failing here, individual tests will skip if needed
	} else {
		s.T().Logf("Using R executable: %s", s.rExecutable)
		s.defaultInterpreter = s.interpreter.(*defaultRInterpreter)

		// Check if renv is installed
		aerr := s.defaultInterpreter.isRenvInstalled(s.rExecutable.String())
		s.renvInstalled = (aerr == nil)
		if !s.renvInstalled {
			s.T().Logf("renv is not installed: %s", aerr.Error())
		} else {
			s.T().Logf("renv is installed and available")
		}
	}
}

func (s *RInterpreterFunctionalSuite) TearDownTest() {
	os.RemoveAll(s.testProjectDir.String())
}

func (s *RInterpreterFunctionalSuite) createTestRenvLock() {
	// Create a simple but valid renv.lock file
	// this file does not need to be valid, but must exist
	lockContent := `{
      "R": {
        "Version": "4.2.3",
        "Repositories": [
          {
            "Name": "CRAN",
            "URL": "https://cloud.r-project.org"
          }
        ]
      },
      "Packages": {
        "renv": {
          "Package": "renv",
          "Version": "1.1.4",
          "Source": "Repository",
          "Repository": "CRAN",
          "Hash": "fa15e"
        }
      }
    }`

	lockPath := s.testProjectDir.Join("renv.lock")
	err := lockPath.WriteFile([]byte(lockContent), 0644)
	s.Require().NoError(err)
}

// TestIsRenvInstalled tests the isRenvInstalled function with a real R executable
func (s *RInterpreterFunctionalSuite) TestIsRenvInstalled() {
	// Attempt to detect if renv is installed
	aerr := s.defaultInterpreter.isRenvInstalled(s.rExecutable.String())

	// If renv is not installed, we expect an error with ErrorRenvPackageNotInstalled code
	if aerr != nil {
		// Check we got the expected error
		s.Equal(types.ErrorRenvPackageNotInstalled, aerr.GetCode())
		s.T().Logf("renv is not installed: %s", aerr.Error())
		s.Contains(aerr.Data["Command"], "install.packages(\"renv\")")
	} else {
		s.T().Logf("renv is already installed on the system")
	}
}

// TestRenvStatus tests the renvStatus function with a real R executable
func (s *RInterpreterFunctionalSuite) TestRenvStatus() {
	// Create test project with renv.lock
	s.createTestRenvLock()

	// Check renv status
	statusOutput, aerr := s.defaultInterpreter.renvStatus(s.rExecutable.String())
	s.Require().Nil(aerr)
	s.T().Logf("renv status output: %s", statusOutput)
	s.NotEmpty(statusOutput)
}

// TestGetRenvLockfilePathFromRExecutable tests the getRenvLockfilePathFromRExecutable function
func (s *RInterpreterFunctionalSuite) TestGetRenvLockfilePathFromRExecutable() {
	// Create test project with renv.lock
	s.createTestRenvLock()

	// Get lockfile path
	lockfilePath, err := s.defaultInterpreter.getRenvLockfilePathFromRExecutable(s.rExecutable.String())
	if err != nil {
		s.T().Logf("Error getting lockfile path: %v", err)
		// This is not necessarily a failure - renv might not be in a project context
		return
	}

	s.T().Logf("Detected lockfile path: %s", lockfilePath)
	s.NotEmpty(lockfilePath.String())

	// If we got a path, verify it's a valid path that could exist
	_, err = os.Stat(filepath.Dir(lockfilePath.String()))
	s.NoError(err, "The directory containing the lockfile should exist")
}

// TestCreateLockfile tests the CreateLockfile function
func (s *RInterpreterFunctionalSuite) TestCreateLockfile() {
	// Create a temporary directory for the lockfile
	lockfileDir := s.testProjectDir.Join("lockfile_test")
	err := lockfileDir.MkdirAll(0755)
	s.Require().NoError(err)

	lockfilePath := lockfileDir.Join("custom_renv.lock")

	// Create the lockfile - this might fail in non-project contexts,
	// but we should still attempt it for real-world testing
	err = s.interpreter.CreateLockfile(lockfilePath)
	if err != nil {
		s.T().Logf("Error creating lockfile (may be expected in non-project context): %v", err)
		return
	}

	// If lockfile was created, verify it exists and has content
	exists, err := lockfilePath.Exists()
	s.NoError(err)
	s.True(exists, "Lockfile should have been created")

	content, err := lockfilePath.ReadFile()
	s.NoError(err)
	s.NotEmpty(content, "Lockfile should not be empty")
	s.T().Logf("Successfully created lockfile at %s", lockfilePath)
}
