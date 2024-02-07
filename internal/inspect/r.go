package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
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
	executor    executor.Executor
	pathLooker  util.PathLooker
	rExecutable util.Path
	log         logging.Logger
}

var _ RInspector = &defaultRInspector{}

const DefaultRenvLockfile = "renv.lock"

func NewRInspector(rExecutable util.Path, log logging.Logger) RInspector {
	return &defaultRInspector{
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
	rVersion, err := i.getRVersion()
	if err != nil {
		return nil, err
	}
	return &config.R{
		Version:        rVersion,
		PackageFile:    DefaultRenvLockfile,
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

func (i *defaultRInspector) getRVersion() (string, error) {
	rExecutable, err := i.getRExecutable()
	if err != nil {
		return "", err
	}
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
	i.log.Info("Detected R", "version", version)
	return version, nil
}
