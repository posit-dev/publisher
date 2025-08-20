package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

// RDependencyScanner generates a temporary renv.lock by invoking R
// and returns the absolute path to that lockfile.
// Inspired by the Python DependencyScanner, but R/renv specific.
type RDependencyScanner interface {
	// ScanDependencies creates a temp directory and uses renv::dependencies +
	// renv::snapshot() to produce a lockfile, returning its absolute path.
	ScanDependencies(base util.AbsolutePath, rExecutable string) (util.AbsolutePath, error)
}

type defaultRDependencyScanner struct {
	rExecutor executor.Executor
	log       logging.Logger
}

func NewRDependencyScanner(log logging.Logger) *defaultRDependencyScanner {
	return &defaultRDependencyScanner{
		rExecutor: executor.NewExecutor(),
		log:       log,
	}
}

func (s *defaultRDependencyScanner) ScanDependencies(base util.AbsolutePath, rExecutable string) (util.AbsolutePath, error) {
	// Create a temp directory in the system temp location (not under the project)
	tmpRoot := util.NewPath("", nil)
	tmpDir, err := tmpRoot.TempDir("publisher-renv-")
	if err != nil {
		return util.AbsolutePath{}, err
	}
	tmpProjectPath := tmpDir

	// Build R script: ensure non-interactive renv, detect deps from the base project (working dir),
	// initialize a temporary renv project in tmpDir, install deps into it, then snapshot its lockfile.
	tmpProjPath := filepath.ToSlash(tmpProjectPath.String()) // Use forward-slash for compatibility across platforms.
	script := fmt.Sprintf(`(function(){
	if (is.function(renv::consent)) try(renv::consent(provided = TRUE), silent = TRUE)
	deps <- tryCatch({
		d <- renv::dependencies(path = ".", progress = FALSE)
		unique(stats::na.omit(d$Package))
	}, error = function(e) character())
	deps <- setdiff(deps, c("renv"))
	proj <- "%s"
	try(renv::init(project = proj, bare = TRUE, force = TRUE), silent = TRUE)
	if (length(deps) > 0) try(renv::install(deps, project = proj), silent = TRUE)
	lockfile <- file.path(proj, "renv.lock")
	renv::snapshot(project = proj, lockfile = lockfile, prompt = FALSE, type = "all")
	invisible()
})()`, tmpProjPath)

	// Run the script (project must be the working directory)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, base, s.log)
	s.log.Debug("RDependencyScanner renv scan", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return util.AbsolutePath{}, err
	}

	// Ensure the lockfile was created
	lockfilePath := tmpDir.Join("renv.lock")
	exists, err := lockfilePath.Exists()
	if err != nil {
		return util.AbsolutePath{}, err
	}
	if !exists {
		return util.AbsolutePath{}, fmt.Errorf("renv could not create lockfile: %s", lockfilePath.String())
	}
	return util.NewAbsolutePath(lockfilePath.String(), nil), nil
}
