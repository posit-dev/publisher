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
	"github.com/stretchr/testify/require"
)

func TestRDependencyScanner_ScanDependencies(t *testing.T) {
	r := require.New(t)

	// Setup in-memory workspace base
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	r.NoError(err)
	r.NoError(cwd.MkdirAll(0777))

	log := logging.New()

	// Fake R executable path
	rExecPath := "/usr/bin/R"

	// Mock executor to capture the script invocation; return success
	exec := executortest.NewMockExecutor()
	exec.On(
		"RunScript",
		rExecPath,
		[]string{"-s"},
		mock.MatchedBy(func(script string) bool {
			return strings.Contains(script, "renv::dependencies(") && strings.Contains(script, "renv::snapshot(")
		}),
		cwd,
		mock.Anything,
	).Return([]byte("ok"), []byte(""), nil).Run(func(args mock.Arguments) {
		// Extract the project path (proj <- "...") from the script and create proj/renv.lock
		script := args.Get(2).(string)
		start := strings.Index(script, "proj <- \"")
		if start >= 0 {
			start += len("proj <- \"")
			end := strings.Index(script[start:], "\"")
			if end > 0 {
				proj := script[start : start+end]
				lock := util.NewAbsolutePath(filepath.Join(proj, "renv.lock"), nil)
				_ = lock.WriteFile([]byte("{}"), 0666)
			}
		}
	})

	scanner := NewRDependencyScanner(log)
	scanner.rExecutor = exec

	lockfilePath, err := scanner.ScanDependencies(cwd, rExecPath)
	r.NoError(err)
	// Should be an absolute path ending with renv.lock
	r.True(filepath.IsAbs(lockfilePath.String()))
	r.Equal("renv.lock", filepath.Base(lockfilePath.String()))

	exec.AssertExpectations(t)
}

func TestRDependencyScanner_ErrWhenLockfileNotCreated(t *testing.T) {
	r := require.New(t)

	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	r.NoError(err)
	r.NoError(cwd.MkdirAll(0777))

	log := logging.New()
	rExecPath := "/usr/bin/R"

	// Mock executor: simulate R script success but do NOT create the lockfile
	exec := executortest.NewMockExecutor()
	exec.On(
		"RunScript",
		rExecPath,
		[]string{"-s"},
		mock.Anything, // script
		cwd,
		mock.Anything,
	).Return([]byte("ok"), []byte(""), nil)

	scanner := NewRDependencyScanner(log)
	scanner.rExecutor = exec
	_, err = scanner.ScanDependencies(cwd, rExecPath)
	r.Error(err)
	exec.AssertExpectations(t)
}

// TestRDependencyScanner_Functional runs the scanner against a real R installation
// to generate an actual lockfile and validate its contents using a non-renv package.
func TestRDependencyScanner_Functional(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional test in short mode")
	}

	r := require.New(t)
	log := logging.New()

	// Create a real temp project where we can inspect dependencies
	dir, err := os.MkdirTemp("", "publisher-renv-functional-*")
	r.NoError(err)
	defer os.RemoveAll(dir)

	base := util.NewAbsolutePath(dir, nil)

	// Create an R script that uses two packages so the lockfile is meaningful
	rScript := `
			library(glue)
			library(cli)
			y <- glue::glue("a = {1}")
			cli::cli_alert_success(y)
		`
	err = base.Join("main.R").WriteFile([]byte(rScript), 0644)
	r.NoError(err)

	interp, err := interpreters.NewRInterpreter(base, util.Path{}, log, nil, nil, nil)
	r.NoError(err)
	rExec, err := interp.GetRExecutable()
	r.NoError(err)
	r.NotEmpty(rExec.String())

	scanner := NewRDependencyScanner(log)
	lockfilePath, err := scanner.ScanDependencies(base, rExec.String())
	r.NoError(err)

	// Validate the lockfile exists and parses
	exists, err := lockfilePath.Exists()
	r.NoError(err)
	r.True(exists, "lockfile should exist")
	r.True(filepath.IsAbs(lockfilePath.String()))
	r.Equal("renv.lock", filepath.Base(lockfilePath.String()))

	lf, err := ReadLockfile(lockfilePath)
	r.NoError(err)
	r.NotNil(lf.Packages, "Packages map should be present")
	// Assert packages referenced by the script exist in lockfile
	_, hasGlue := lf.Packages[PackageName("glue")]
	_, hasCli := lf.Packages[PackageName("cli")]
	r.True(hasGlue, "lockfile should include glue package entry")
	r.True(hasCli, "lockfile should include cli package entry")
}

// TestRDependencyScanner_Functional_NoMirror forces an R session with no CRAN mirror
// (options(repos) CRAN="@CRAN@") and verifies ScanDependencies does not prompt for a mirror.
func TestRDependencyScanner_Functional_NoMirror(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional test in short mode")
	}

	r := require.New(t)
	log := logging.New()

	// Create a real temp project where we can inspect dependencies
	dir, err := os.MkdirTemp("", "publisher-renv-functional-nocran-*")
	r.NoError(err)
	defer os.RemoveAll(dir)
	base := util.NewAbsolutePath(dir, nil)
	rScript := `
			library(cli)
			cli::cli_alert_success("ok")
		`
	err = base.Join("main.R").WriteFile([]byte(rScript), 0644)
	r.NoError(err)

	// Prepare an R user profile that unsets the CRAN mirror
	// We set CRAN to @CRAN@ to simulate no mirror configured
	profDir, err := os.MkdirTemp("", "r-profile-user-*")
	r.NoError(err)
	defer os.RemoveAll(profDir)
	profPath := filepath.Join(profDir, ".Rprofile")
	r.NoError(os.WriteFile(profPath, []byte(`options(repos = c(CRAN = "@CRAN@"))`), 0644))

	// Ensure R uses the newly created profile and that we restore the old one after the test
	oldProfile := os.Getenv("R_PROFILE_USER")
	t.Cleanup(func() {
		_ = os.Setenv("R_PROFILE_USER", oldProfile)
	})
	r.NoError(os.Setenv("R_PROFILE_USER", profPath))

	interp, err := interpreters.NewRInterpreter(base, util.Path{}, log, nil, nil, nil)
	r.NoError(err)
	rExec, err := interp.GetRExecutable()
	r.NoError(err)
	r.NotEmpty(rExec.String())

	// Confirm renv does not prompt for mirror and lockfile is created.
	scanner := NewRDependencyScanner(log)
	lockfilePath, err := scanner.ScanDependencies(base, rExec.String())
	r.NoError(err)
	exists, e2 := lockfilePath.Exists()
	r.NoError(e2)
	r.True(exists)
}
