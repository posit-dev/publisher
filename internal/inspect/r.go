package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
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
// returning a Python configuration.
// If requirements.txt does not exist, it will be created.
// The python version (and packages if needed) will
// be determined by the specified pythonExecutable,
// or by `python3` or `python` on $PATH.
func (i *defaultRInspector) InspectR() (*config.R, error) {
	rExecutable, err := i.getRExecutable()
	if err != nil {
		return nil, err
	}
	rVersion, err := i.getRVersion(rExecutable)
	if err != nil {
		return nil, err
	}
	lockfilePath, err := i.getRenvLockfile(rExecutable)
	if err != nil {
		return nil, err
	}
	var relPath util.RelativePath
	if lockfilePath.IsAbs() {
		relPath, err = lockfilePath.Rel(i.base)
		if err != nil {
			return nil, err
		}
	} else {
		relPath = util.NewRelativePath(lockfilePath.String(), lockfilePath.Fs())
	}

	return &config.R{
		Version:        rVersion,
		PackageFile:    relPath.String(),
		PackageManager: "renv",
	}, nil
}

func (i *defaultRInspector) validateRExecutable(rExecutable string) error {
	args := []string{"--version"}
	_, err := i.executor.RunCommand(rExecutable, args, i.log)
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
	output, err := i.executor.RunCommand(rExecutable, args, i.log)
	if err != nil {
		return "", err
	}
	line := strings.SplitN(string(output), "\n", 2)[0]
	m := rVersionRE.FindStringSubmatch(line)
	if len(m) < 2 {
		return "", fmt.Errorf("couldn't parse R version from output: %s", line)
	}
	version := m[1]
	i.log.Info("Detected R version", "version", version)
	return version, nil
}

var renvLockRE = regexp.MustCompile(`^\[1\] "(.*)"$`)

func (i *defaultRInspector) getRenvLockfile(rExecutable string) (util.Path, error) {
	i.log.Info("Getting renv lockfile path", "r", rExecutable)
	args := []string{"-s", "-e", "renv::paths$lockfile()"}
	output, err := i.executor.RunCommand(rExecutable, args, i.log)
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			i.log.Warn("Couldn't detect lockfile path; is renv installed?")
			return util.NewPath(DefaultRenvLockfile, i.base.Fs()), nil
		} else {
			return util.Path{}, err
		}
	}
	line := strings.SplitN(string(output), "\n", 2)[0]
	m := renvLockRE.FindStringSubmatch(line)
	if len(m) < 2 {
		return util.Path{}, fmt.Errorf("couldn't parse renv lockfile path from output: %s", line)
	}
	path := m[1]
	i.log.Info("Detected renv lockfile path", "path", path)
	return util.NewPath(path, i.base.Fs()), nil
}
