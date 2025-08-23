package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"
	"strings"

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
	ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error)
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

func (s *defaultRDependencyScanner) ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error) {
	if len(paths) == 0 {
		return util.AbsolutePath{}, fmt.Errorf("no paths to scan dependencies of")
	}

	// Create a temp directory in the system temp location (not under the project)
	tmpRoot := util.NewPath("", nil)
	tmpProjectPath, err := tmpRoot.TempDir("publisher-renv-")
	if err != nil {
		return util.AbsolutePath{}, err
	}

	// Build R script: ensure non-interactive renv, detect deps from the base project (working dir),
	// initialize a temporary renv project in tmpDir, install deps into it, then snapshot its lockfile.
	tmpProjPath := filepath.ToSlash(tmpProjectPath.String()) // Use forward-slash for compatibility across platforms.
	rPathsVec, err := s.toRPathsVector(paths)
	if err != nil {
		return util.AbsolutePath{}, err
	}
	script := fmt.Sprintf(`(function(){
	if (is.function(renv::consent)) try(renv::consent(provided = TRUE), silent = TRUE)
	rPathsVec <- %s
	deps <- tryCatch({
		d <- renv::dependencies(path = rPathsVec, progress = FALSE)
		unique(stats::na.omit(d$Package))
	}, error = function(e) character())
	deps <- setdiff(deps, c("renv"))
	tmpProjPath <- "%s"
	try(renv::init(project = tmpProjPath, bare = TRUE, force = TRUE), silent = TRUE)
	if (length(deps) > 0) try(renv::install(deps, project = tmpProjPath), silent = TRUE)
	lockfile <- file.path(tmpProjPath, "renv.lock")
	renv::snapshot(project = tmpProjPath, lockfile = lockfile, prompt = FALSE, type = "all")
	invisible()
})()`, rPathsVec, tmpProjPath)

	// Run the script (use the temporary project as the working directory)
	// Ensure working directory is provided as an AbsolutePath
	absTmp := util.NewAbsolutePath(tmpProjectPath.String(), nil)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, absTmp, s.log)
	s.log.Debug("RDependencyScanner renv scan", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return util.AbsolutePath{}, err
	}

	// Ensure the lockfile was created
	lockfilePath := tmpProjectPath.Join("renv.lock")
	exists, err := lockfilePath.Exists()
	if err != nil {
		return util.AbsolutePath{}, err
	}
	if !exists {
		return util.AbsolutePath{}, fmt.Errorf("renv could not create lockfile: %s", lockfilePath.String())
	}
	return util.NewAbsolutePath(lockfilePath.String(), nil), nil
}

// toRPathsVector converts a slice of filesystem paths/globs into an R c("a", "b") vector string.
// It validates each path to avoid unsafe characters for direct injection into an R string literal
// without escaping. We intentionally do not escape uncommon characters; instead we reject unsafe inputs.
func (s *defaultRDependencyScanner) toRPathsVector(paths []string) (string, error) {
	if len(paths) == 0 {
		return "c()", nil
	}

	quoted := make([]string, 0, len(paths))
	for _, p := range paths {
		// Normalize separators to forward slashes for cross-system compatibility.
		norm := filepath.ToSlash(p)
		// Validate for unsafe characters that could break the R string literal when unescaped
		if strings.ContainsRune(norm, '"') || strings.ContainsRune(norm, '\n') || strings.ContainsRune(norm, '\r') {
			return "", fmt.Errorf("path contains invalid characters: %q", p)
		}
		quoted = append(quoted, "\""+norm+"\"")
	}
	return "c(" + strings.Join(quoted, ", ") + ")", nil
}
