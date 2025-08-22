package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

// RDependencyScannerSuite groups unit tests for R dependency scanning using testify/suite
type RDependencyScannerSuite struct {
	suite.Suite
	fs        afero.Fs
	cwd       util.AbsolutePath
	log       logging.Logger
	rExecPath string
	exec      *executortest.MockExecutor
}

func TestRDependencyScannerSuite(t *testing.T) {
	suite.Run(t, new(RDependencyScannerSuite))
}

func (s *RDependencyScannerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.NoError(cwd.MkdirAll(0777))
	s.cwd = cwd
	s.log = logging.New()
	s.rExecPath = "/usr/bin/R"
	s.exec = executortest.NewMockExecutor()
}

func (s *RDependencyScannerSuite) TestScanDependencies() {
	// Expect a RunScript call that includes renv::dependencies and renv::snapshot
	s.exec.On(
		"RunScript",
		s.rExecPath,
		[]string{"-s"},
		mock.MatchedBy(func(script string) bool {
			return strings.Contains(script, "renv::dependencies(") && strings.Contains(script, "renv::snapshot(")
		}),
		mock.Anything, // working dir is the temporary project now
		mock.Anything,
	).Return([]byte("ok"), []byte(""), nil).Run(func(args mock.Arguments) {
		// Extract tmpProjPath from the script and create tmpProjPath/renv.lock
		script := args.Get(2).(string)
		start := strings.Index(script, "tmpProjPath <- \"")
		if start >= 0 {
			start += len("tmpProjPath <- \"")
			end := strings.Index(script[start:], "\"")
			if end > 0 {
				proj := script[start : start+end]
				lock := util.NewAbsolutePath(filepath.Join(proj, "renv.lock"), nil)
				_ = lock.WriteFile([]byte("{}"), 0666)
			}
		}
	})

	scanner := NewRDependencyScanner(s.log)
	scanner.rExecutor = s.exec

	lockfilePath, err := scanner.ScanDependencies([]string{s.cwd.String()}, s.rExecPath)
	s.NoError(err)
	s.True(filepath.IsAbs(lockfilePath.String()))
	s.Equal("renv.lock", filepath.Base(lockfilePath.String()))

	s.exec.AssertExpectations(s.T())
}

func (s *RDependencyScannerSuite) TestErrWhenLockfileNotCreated() {
	// Simulate script success but do NOT create lockfile
	s.exec.On(
		"RunScript",
		s.rExecPath,
		[]string{"-s"},
		mock.Anything,
		mock.Anything,
		mock.Anything,
	).Return([]byte("ok"), []byte(""), nil)

	scanner := NewRDependencyScanner(s.log)
	scanner.rExecutor = s.exec

	_, err := scanner.ScanDependencies([]string{s.cwd.String()}, s.rExecPath)
	s.Error(err)
	s.exec.AssertExpectations(s.T())
}

// RDependencyScannerFunctionalSuite groups functional tests that require a real R installation.
type RDependencyScannerFunctionalSuite struct {
	suite.Suite
	log logging.Logger
}

func TestRDependencyScannerFunctionalSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional suite in short mode")
	}
	suite.Run(t, new(RDependencyScannerFunctionalSuite))
}

func (s *RDependencyScannerFunctionalSuite) SetupTest() {
	s.log = logging.New()
}

// runs the scanner against a real R installation and validates multiple packages appear in the lockfile
func (s *RDependencyScannerFunctionalSuite) TestFunctional() {
	if testing.Short() {
		s.T().Skip("skipping functional test in short mode")
	}

	// Create a real temp project where we can inspect dependencies
	dir := s.T().TempDir()
	base := util.NewAbsolutePath(dir, nil)

	// Create an R script that uses two packages so the lockfile is meaningful
	rScript := `
			library(glue)
			library(cli)
			y <- glue::glue("a = {1}")
			cli::cli_alert_success(y)
		`
	err := base.Join("main.R").WriteFile([]byte(rScript), 0644)
	s.NoError(err)

	// Also create a nested directory with another script using a different package
	s.NoError(base.Join("nested").MkdirAll(0777))
	nestedScript := `
			library(jsonlite)
			jsonlite::toJSON(list(a=1))
		`
	s.NoError(base.Join("nested", "child.R").WriteFile([]byte(nestedScript), 0644))

	interp, err := interpreters.NewRInterpreter(base, util.Path{}, s.log, nil, nil, nil)
	s.NoError(err)
	rExec, err := interp.GetRExecutable()
	s.NoError(err)
	s.NotEmpty(rExec.String())

	scanner := NewRDependencyScanner(s.log)
	lockfilePath, err := scanner.ScanDependencies([]string{base.String()}, rExec.String())
	s.NoError(err)

	// Validate the lockfile exists and parses
	exists, err := lockfilePath.Exists()
	s.NoError(err)
	s.True(exists, "lockfile should exist")
	s.True(filepath.IsAbs(lockfilePath.String()))
	s.Equal("renv.lock", filepath.Base(lockfilePath.String()))

	lf, err := ReadLockfile(lockfilePath)
	s.NoError(err)
	s.NotNil(lf.Packages, "Packages map should be present")
	// Assert packages referenced by the scripts (including nested) exist in lockfile
	_, hasGlue := lf.Packages[PackageName("glue")]
	_, hasCli := lf.Packages[PackageName("cli")]
	_, hasJsonlite := lf.Packages[PackageName("jsonlite")]
	s.True(hasGlue, "lockfile should include glue package entry")
	s.True(hasCli, "lockfile should include cli package entry")
	s.True(hasJsonlite, "lockfile should include jsonlite from nested file")
}

// forces an R session with no CRAN mirror and verifies ScanDependencies does not prompt for a mirror
func (s *RDependencyScannerFunctionalSuite) TestFunctional_NoMirror() {
	if testing.Short() {
		s.T().Skip("skipping functional test in short mode")
	}

	// Create a real temp project where we can inspect dependencies
	dir := s.T().TempDir()
	base := util.NewAbsolutePath(dir, nil)
	rScript := `
			library(cli)
			cli::cli_alert_success("ok")
		`
	s.NoError(base.Join("main.R").WriteFile([]byte(rScript), 0644))

	// Prepare an R user profile that unsets the CRAN mirror
	profDir := s.T().TempDir()
	profPath := filepath.Join(profDir, ".Rprofile")
	s.NoError(os.WriteFile(profPath, []byte(`options(repos = c(CRAN = "@CRAN@"))`), 0644))

	// Ensure R uses the newly created profile and that we restore the old one after the test
	oldProfile := os.Getenv("R_PROFILE_USER")
	s.T().Cleanup(func() { _ = os.Setenv("R_PROFILE_USER", oldProfile) })
	s.NoError(os.Setenv("R_PROFILE_USER", profPath))

	interp, err := interpreters.NewRInterpreter(base, util.Path{}, s.log, nil, nil, nil)
	s.NoError(err)
	rExec, err := interp.GetRExecutable()
	s.NoError(err)
	s.NotEmpty(rExec.String())

	scanner := NewRDependencyScanner(s.log)
	lockfilePath, err := scanner.ScanDependencies([]string{base.String()}, rExec.String())
	s.NoError(err)
	exists, e2 := lockfilePath.Exists()
	s.NoError(e2)
	s.True(exists)
}

// ensures that when specific paths are provided, only dependencies from those paths are included
func (s *RDependencyScannerFunctionalSuite) TestFunctional_PathsFilter() {
	if testing.Short() {
		s.T().Skip("skipping functional test in short mode")
	}

	dir := s.T().TempDir()
	base := util.NewAbsolutePath(dir, nil)

	// included file references glue
	included := base.Join("included.R")
	s.NoError(included.WriteFile([]byte(`library(glue); glue::glue("x={1}")`), 0644))

	// ignored file references cli (should not be scanned)
	ignored := base.Join("ignored.R")
	s.NoError(ignored.WriteFile([]byte(`library(cli); cli::cli_alert_success("ok")`), 0644))

	interp, err := interpreters.NewRInterpreter(base, util.Path{}, s.log, nil, nil, nil)
	s.NoError(err)
	rExec, err := interp.GetRExecutable()
	s.NoError(err)
	s.NotEmpty(rExec.String())

	scanner := NewRDependencyScanner(s.log)
	lockfilePath, err := scanner.ScanDependencies([]string{included.String()}, rExec.String())
	s.NoError(err)

	exists, err := lockfilePath.Exists()
	s.NoError(err)
	s.True(exists)

	// The lockfile should only have glue, as ignored.R was not passed to ScanDependencies.
	lf, err := ReadLockfile(lockfilePath)
	s.NoError(err)
	_, hasGlue := lf.Packages[PackageName("glue")]
	_, hasCli := lf.Packages[PackageName("cli")]
	s.True(hasGlue, "lockfile should include glue from included file")
	s.False(hasCli, "lockfile should NOT include cli from ignored file")
}
