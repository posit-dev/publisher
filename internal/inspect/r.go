package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"os/exec"
	"regexp"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type RInspector interface {
	InspectR() (*config.R, error)
	CreateLockfile(lockfilePath util.AbsolutePath) error
}

type defaultRInspector struct {
	base        util.AbsolutePath
	executor    executor.Executor
	pathLooker  util.PathLooker
	rExecutable util.Path
	log         logging.Logger
}

var _ RInspector = &defaultRInspector{}

const DefaultRenvLockfile = "renv.lock"

var rVersionCache = make(map[string]string)

func NewRInspector(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) RInspector {
	return &defaultRInspector{
		base:        base,
		executor:    executor.NewExecutor(),
		pathLooker:  util.NewPathLooker(),
		rExecutable: rExecutable,
		log:         log,
	}
}

// InspectR inspects the specified project directory,
// returning an R configuration.
// If R is available, use it to determine the renv lockfile path
// (to support renv profiles). Otherwise, look for renv.lock.
// If there's a lockfile, we get the R version from there.
// Otherwise, we run R to get the version (and if it's not
// available, that's an error).
func (i *defaultRInspector) InspectR() (*config.R, error) {
	lockfilePath := i.base.Join(DefaultRenvLockfile)
	exists, err := lockfilePath.Exists()
	if err != nil {
		i.log.Debug("Error while looking up renv lock file", "renv_lock", lockfilePath)
		return nil, err
	}

	var rExecutable string
	var getRExecutableErr error

	if !exists {
		// Maybe R can give us the lockfile path (e.g. from an renv profile)
		i.log.Debug("Attempting to get renv lock file via R executable")
		rExecutable, getRExecutableErr = i.getRExecutable()
		if getRExecutableErr == nil {
			lockfilePath, err = i.getRenvLockfile(rExecutable)
			if err != nil {
				i.log.Debug("Error attempting to get renv lockfile path via R executable", "r_executable", rExecutable, "error", err.Error())
				return nil, err
			}
			exists, err = lockfilePath.Exists()
			if err != nil {
				i.log.Debug("Error asserting renv lockfile exists", "renv_lock", lockfilePath, "error", err.Error())
				return nil, err
			}
			if exists {
				i.log.Debug("renv lockfile found via R executable", "r_executable", rExecutable, "renv_lock", lockfilePath)
			}
		} // else stay with the default lockfile path
	}

	var rVersion string

	if exists {
		// Get R version from the lockfile
		rVersion, err = i.getRVersionFromLockfile(lockfilePath)
		if err != nil {
			i.log.Debug("Error getting R version from existing renv lockfile. Attempting to get R version from executable", "renv_lock", lockfilePath, "error", err.Error())
			rExecutable, getRExecutableErr = i.getRExecutable()
		}
	}

	// renv.lock exists but could not be read
	// thus, R version is still empty
	renvFallback := exists && rVersion == ""
	if !exists || renvFallback {
		// Now R is required, err if it couldn't be found.
		if getRExecutableErr != nil {
			i.log.Debug("R is required and could not be found", "error", getRExecutableErr)
			return nil, getRExecutableErr
		}
		rVersion, err = i.getRVersion(rExecutable)
		if err != nil {
			i.log.Debug("Error while looking up for R version from executable", "r_executable", rExecutable, "error", err.Error())
			return nil, err
		}
	}
	lockfileRelPath, err := lockfilePath.Rel(i.base)
	if err != nil {
		i.log.Debug("Error getting relative path for renv lockfile", "basepath", i.base.String(), "error", err.Error())
		return nil, err
	}
	return &config.R{
		Version:        rVersion,
		PackageFile:    lockfileRelPath.String(),
		PackageManager: "renv",
	}, nil
}

// CreateLockfile creates a lockfile at the specified path
// by invoking R to run `renv::snapshot()`.
func (i *defaultRInspector) CreateLockfile(lockfilePath util.AbsolutePath) error {
	rExecutable, err := i.getRExecutable()
	if err != nil {
		return err
	}
	i.log.Info("Creating renv lockfile", "path", lockfilePath.String(), "r", rExecutable)

	err = lockfilePath.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}

	escaped := strings.ReplaceAll(lockfilePath.String(), `\`, `\\`)
	code := fmt.Sprintf(`renv::snapshot(lockfile="%s")`, escaped)
	args := []string{"-s", "-e", code}
	stdout, stderr, err := i.executor.RunCommand(rExecutable, args, i.base, i.log)
	i.log.Debug("renv::snapshot()", "out", string(stdout), "err", string(stderr))
	return err
}

func (i *defaultRInspector) validateRExecutable(rExecutable string) error {
	_, err := i.getRVersion(rExecutable)
	if err != nil {
		return fmt.Errorf("could not run R executable '%s': %w", rExecutable, err)
	}
	return nil
}

func (i *defaultRInspector) getRExecutable() (string, error) {
	if i.rExecutable.String() != "" {
		// User-provided R executable
		exists, err := i.rExecutable.Exists()
		if err != nil {
			return "", err
		}
		if exists {
			return i.rExecutable.String(), nil
		}
		return "", fmt.Errorf(
			"cannot find the specified R executable %s: %w",
			i.rExecutable, fs.ErrNotExist)
	} else {
		// Use whatever is on PATH
		path, err := i.pathLooker.LookPath("R")
		if err == nil {
			// Ensure the R is actually runnable.
			err = i.validateRExecutable(path)
		}
		if err != nil {
			return "", err
		}
		return path, nil
	}
}

var rVersionRE = regexp.MustCompile(`^R version (\d+\.\d+\.\d+)`)

func (i *defaultRInspector) getRVersion(rExecutable string) (string, error) {
	if version, ok := rVersionCache[rExecutable]; ok {
		return version, nil
	}
	i.log.Info("Getting R version", "r", rExecutable)
	args := []string{"--version"}
	output, stderr, err := i.executor.RunCommand(rExecutable, args, util.AbsolutePath{}, i.log)
	if err != nil {
		return "", err
	}
	lines := strings.SplitN(string(append(output, stderr...)), "\n", -1)
	for _, l := range lines {
		i.log.Info("Parsing line for R version", "l", l)
		m := rVersionRE.FindStringSubmatch(l)
		if len(m) < 2 {
			continue
		}
		version := m[1]
		i.log.Info("Detected R version", "version", version)
		rVersionCache[rExecutable] = version
		return version, nil
	}
	return "", fmt.Errorf("couldn't parse R version from command output (%s --version)", rExecutable)
}

var renvLockRE = regexp.MustCompile(`^\[1\] "(.*)"`)

func (i *defaultRInspector) getRenvLockfile(rExecutable string) (util.AbsolutePath, error) {
	defaultLockfilePath := i.base.Join(DefaultRenvLockfile)
	exists, err := defaultLockfilePath.Exists()
	if err != nil {
		return util.AbsolutePath{}, err
	}
	if exists {
		i.log.Info("Found default renv lockfile", "path", defaultLockfilePath.String())
		return defaultLockfilePath, nil
	}
	i.log.Info("Getting renv lockfile path", "r", rExecutable)
	args := []string{"-s", "-e", "renv::paths$lockfile()"}
	output, _, err := i.executor.RunCommand(rExecutable, args, i.base, i.log)
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			i.log.Warn("Couldn't detect lockfile path; is renv installed?")
			return i.base.Join(DefaultRenvLockfile), nil
		} else {
			return util.AbsolutePath{}, err
		}
	}
	for _, line := range strings.Split(string(output), "\n") {
		m := renvLockRE.FindStringSubmatch(line)
		if len(m) < 2 {
			continue
		}
		// paths$lockfile returns an absolute path
		path := m[1]
		i.log.Info("renv::paths$lockfile returned lockfile path", "path", path)
		return util.NewAbsolutePath(path, nil), nil
	}
	return util.AbsolutePath{}, fmt.Errorf("couldn't parse renv lockfile path from output: %s", output)
}

type renvLockfile struct {
	// Only the fields we use are here
	R struct {
		Version string
	}
}

func (i *defaultRInspector) getRVersionFromLockfile(lockfilePath util.AbsolutePath) (string, error) {
	content, err := lockfilePath.ReadFile()
	if err != nil {
		return "", err
	}
	var lockfileContent renvLockfile
	err = json.NewDecoder(bytes.NewReader(content)).Decode(&lockfileContent)
	if err != nil {
		return "", err
	}
	return lockfileContent.R.Version, nil
}
