package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
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

	// SetupRenvInDir sets up renv in the specified directory with the given lockfile name
	// and R executable path, returning the absolute path to the created lockfile.
	SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error)
}

type defaultRDependencyScanner struct {
	rExecutor executor.Executor
	log       logging.Logger
	repoOpts  *RepoOptions
}

// NewRDependencyScanner creates a dependency scanner. If repoOpts is non-nil,
// the scanner configures R repositories accordingly.
func NewRDependencyScanner(log logging.Logger, repoOpts *RepoOptions) *defaultRDependencyScanner {
	return &defaultRDependencyScanner{
		rExecutor: executor.NewExecutor(),
		log:       log,
		repoOpts:  repoOpts,
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

	return s.ScanDependenciesInDir(paths, tmpProjectPath, "", rExecutable)
}

func (i *defaultRDependencyScanner) SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	pathSlice := []string{targetPath}

	return i.ScanDependenciesInDir(pathSlice, util.NewPath(targetPath, nil), lockfile, rExecutable)
}

// ScanDependenciesInDir uses renv to scan the provided paths and create set up
func (s *defaultRDependencyScanner) ScanDependenciesInDir(paths []string, targetDir util.Path, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	if lockfile == "" {
		lockfile = interpreters.DefaultRenvLockfile
	}

	// detect dependencies from the provided paths
	deps, err := s.detectDependencies(paths, rExecutable, targetDir)
	if err != nil {
		return util.AbsolutePath{}, err
	}

	// attempt to snapshot from existing installed packages
	err = s.snapshotFromExisting(deps, targetDir, lockfile, rExecutable)
	if err == nil {
		s.log.Info("Created lockfile from installed packages")
		lockfilePath := targetDir.Join(lockfile)
		return util.NewAbsolutePath(lockfilePath.String(), nil), nil
	}

	// if not all packages are already available, install fresh then snapshot
	s.log.Info("Installing packages to create lockfile", "reason", err.Error())
	err = s.installThenSnapshot(deps, targetDir, lockfile, rExecutable)
	if err != nil {
		return util.AbsolutePath{}, err
	}

	lockfilePath := targetDir.Join(lockfile)
	return util.NewAbsolutePath(lockfilePath.String(), nil), nil
}

// detectDependencies runs renv::dependencies on the provided paths and returns
// a deduplicated list of package names (excluding renv itself).
func (s *defaultRDependencyScanner) detectDependencies(paths []string, rExecutable string, workDir util.Path) ([]string, error) {
	rPathsVec, err := s.toRPathsVector(paths)
	if err != nil {
		return nil, err
	}

	repoURL := RepoURLFromOptions(s.repoOpts)
	script := fmt.Sprintf(`(function(){
	options(renv.consent = TRUE)
	repoUrl <- "%s"
	if (nzchar(repoUrl)) options(repos = c(CRAN = repoUrl))
	rPathsVec <- %s
	deps <- character()
	for (path in rPathsVec) {
		tryCatch({
			d <- renv::dependencies(path = path, progress = FALSE)
			deps <- c(deps, d$Package[!is.na(d$Package)])
		}, error = function(e) {
			# Silently skip paths that cause errors (e.g., non-existent files, directories)
			invisible()
		})
	}
	deps <- unique(setdiff(deps, c("renv")))
	cat(paste(deps, collapse = "\n"))
})()`, repoURL, rPathsVec)

	absWorkDir := util.NewAbsolutePath(workDir.String(), nil)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, absWorkDir, s.log)
	s.log.Debug("RDependencyScanner detect dependencies", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return nil, err
	}

	// Parse the output - one package per line
	output := strings.TrimSpace(string(stdout))
	if output == "" {
		return []string{}, nil
	}
	deps := strings.Split(output, "\n")
	return deps, nil
}

// depsToRVector converts a slice of package names into an R vector string like c("pkg1", "pkg2").
// Returns "c()" for empty slices.
func (s *defaultRDependencyScanner) depsToRVector(deps []string) string {
	if len(deps) == 0 {
		return "c()"
	}
	quoted := make([]string, len(deps))
	for i, dep := range deps {
		quoted[i] = "\"" + dep + "\""
	}
	return "c(" + strings.Join(quoted, ", ") + ")"
}

// snapshotFromExisting attempts to create a lockfile by snapshotting from the user's
// existing installed packages. Returns an error if the snapshot fails.
func (s *defaultRDependencyScanner) snapshotFromExisting(deps []string, targetDir util.Path, lockfile string, rExecutable string) error {
	normalizedProjectPath := filepath.ToSlash(targetDir.String())
	lockfile = filepath.ToSlash(lockfile)
	repoURL := RepoURLFromOptions(s.repoOpts)

	depsVec := s.depsToRVector(deps)

	script := fmt.Sprintf(`(function(){
	options(renv.consent = TRUE)
	repoUrl <- "%s"
	if (nzchar(repoUrl)) options(repos = c(CRAN = repoUrl))
	deps <- %s
	targetPath <- "%s"
	lockfile <- file.path(targetPath, "%s")

	renv::snapshot(
		project = targetPath,
		packages = deps,
		lockfile = lockfile,
		prompt = FALSE
	)
	message("publisher: created lockfile from installed packages")
})()`, repoURL, depsVec, normalizedProjectPath, lockfile)

	absTarget := util.NewAbsolutePath(targetDir.String(), nil)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, absTarget, s.log)
	s.log.Debug("RDependencyScanner snapshot from existing", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return fmt.Errorf("snapshot from existing failed: %w", err)
	}

	// Verify the lockfile was created
	lockfilePath := targetDir.Join(lockfile)
	exists, err := lockfilePath.Exists()
	if err != nil {
		return fmt.Errorf("failed to check lockfile existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("lockfile was not created")
	}

	return nil
}

// installThenSnapshot creates a lockfile by initializing an renv project,
// installing the required packages, and then snapshotting.
func (s *defaultRDependencyScanner) installThenSnapshot(deps []string, targetDir util.Path, lockfile string, rExecutable string) error {
	normalizedProjectPath := filepath.ToSlash(targetDir.String())
	lockfile = filepath.ToSlash(lockfile)
	repoURL := RepoURLFromOptions(s.repoOpts)

	depsVec := s.depsToRVector(deps)

	script := fmt.Sprintf(`(function(){
	options(renv.consent = TRUE)
	repoUrl <- "%s"
	if (nzchar(repoUrl)) options(repos = c(CRAN = repoUrl))
	deps <- %s
	targetPath <- "%s"
	lockfile <- file.path(targetPath, "%s")

	renv::init(project = targetPath, bare = TRUE, force = TRUE)
	renv::install(deps, project = targetPath)
	renv::snapshot(project = targetPath, lockfile = lockfile, prompt = FALSE, type = "all")
	message("publisher: installing packages to create lockfile")
})()`, repoURL, depsVec, normalizedProjectPath, lockfile)

	absTarget := util.NewAbsolutePath(targetDir.String(), nil)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, absTarget, s.log)
	s.log.Debug("RDependencyScanner install then snapshot", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return fmt.Errorf("install then snapshot failed: %w", err)
	}

	// Verify the lockfile was created
	lockfilePath := targetDir.Join(lockfile)
	exists, err := lockfilePath.Exists()
	if err != nil {
		return fmt.Errorf("failed to check lockfile existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("renv could not create lockfile: %s", lockfilePath.String())
	}

	return nil
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

// RepoOptions defines how to set R repositories during dependency scanning.
// Values mirror VS Code setting `positron.r.defaultRepositories`.
type RepoOptions struct {
	// RDefaultRepositories selects which R repository set to prefer.
	// One of: "auto", "rstudio", "posit-ppm", "none", or a full http(s) URL.
	RDefaultRepositories string
	// RPackageManagerRepository is an optional custom PPM base URL, used when RDefaultRepositories == "auto".
	RPackageManagerRepository string
}

func repoURLFrom(mode, ppm string) string {
	switch mode {
	case "auto":
		if ppm != "" {
			return strings.TrimRight(ppm, "/")
		}
		return "https://cloud.r-project.org"
	case "posit-ppm":
		return "https://packagemanager.posit.co/cran/latest"
	case "rstudio":
		return "https://cran.rstudio.com"
	case "none":
		return ""
	default:
		if strings.HasPrefix(mode, "http://") || strings.HasPrefix(mode, "https://") {
			return strings.TrimRight(mode, "/")
		}
		return ""
	}
}

func RepoURLFromOptions(opts *RepoOptions) string {
	if opts == nil {
		// Unconfigured defaults to CRAN via "auto" mode
		return repoURLFrom("auto", "")
	}
	mode := strings.ToLower(strings.TrimSpace(opts.RDefaultRepositories))
	if mode == "" {
		mode = "auto"
	}
	return repoURLFrom(mode, strings.TrimSpace(opts.RPackageManagerRepository))
}
