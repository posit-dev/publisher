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

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type RInspector interface {
	InspectR() (*config.R, error)
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
	var rVersion string
	var lockfilePath util.AbsolutePath
	var err error

	rExecutable, getRExecutableErr := i.getRExecutable()
	if getRExecutableErr == nil {
		lockfilePath, err = i.getRenvLockfile(rExecutable)
		if err != nil {
			return nil, err
		}
	} else {
		lockfilePath = i.base.Join(DefaultRenvLockfile)
	}
	exists, err := lockfilePath.Exists()
	if err != nil {
		return nil, err
	}
	if exists {
		// Get R version from the lockfile
		rVersion, err = i.getRVersionFromLockfile(lockfilePath)
		if err != nil {
			return nil, err
		}
	} else {
		// Now R is required, err if it couldn't be found.
		if getRExecutableErr != nil {
			return nil, getRExecutableErr
		}
		rVersion, err = i.getRVersion(rExecutable)
		if err != nil {
			return nil, err
		}
	}
	lockfileRelPath, err := lockfilePath.Rel(i.base)
	if err != nil {
		return nil, err
	}
	return &config.R{
		Version:        rVersion,
		PackageFile:    lockfileRelPath.String(),
		PackageManager: "renv",
	}, nil
}

func (i *defaultRInspector) validateRExecutable(rExecutable string) error {
	args := []string{"--version"}
	_, _, err := i.executor.RunCommand(rExecutable, args, i.log)
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
	i.log.Info("Getting R version", "r", rExecutable)
	args := []string{"--version"}
	output, stderr, err := i.executor.RunCommand(rExecutable, args, i.log)
	if err != nil {
		return "", err
	}
	line := strings.SplitN(string(append(output, stderr...)), "\n", 2)[0]
	m := rVersionRE.FindStringSubmatch(line)
	if len(m) < 2 {
		return "", fmt.Errorf("couldn't parse R version from output: %s", line)
	}
	version := m[1]
	i.log.Info("Detected R version", "version", version)
	return version, nil
}

var renvLockRE = regexp.MustCompile(`^\[1\] "(.*)"$`)

func (i *defaultRInspector) getRenvLockfile(rExecutable string) (util.AbsolutePath, error) {
	i.log.Info("Getting renv lockfile path", "r", rExecutable)
	args := []string{"-s", "-e", "renv::paths$lockfile()"}
	output, _, err := i.executor.RunCommand(rExecutable, args, i.log)
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			i.log.Warn("Couldn't detect lockfile path; is renv installed?")
			return i.base.Join(DefaultRenvLockfile), nil
		} else {
			return util.AbsolutePath{}, err
		}
	}
	line := strings.SplitN(string(output), "\n", 2)[0]
	m := renvLockRE.FindStringSubmatch(line)
	if len(m) < 2 {
		return util.AbsolutePath{}, fmt.Errorf("couldn't parse renv lockfile path from output: %s", line)
	}
	// paths$lockfile returns an absolute path
	path := m[1]
	i.log.Info("Detected renv lockfile path", "path", path)
	return util.NewAbsolutePath(path, nil), nil
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
