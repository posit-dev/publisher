package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"regexp"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/inspect/dependencies/pydeps"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PythonInspector interface {
	InspectPython(base util.Path) (*config.Python, error)
	CreateRequirementsFile(base util.Path, dest util.Path) error
}

type defaultPythonInspector struct {
	executor   executor.Executor
	pathLooker util.PathLooker
	scanner    pydeps.DependencyScanner
	pythonPath util.Path
	log        logging.Logger
}

var _ PythonInspector = &defaultPythonInspector{}

const PythonRequirementsFilename = "requirements.txt"

func NewPythonInspector(pythonPath util.Path, log logging.Logger) PythonInspector {
	return &defaultPythonInspector{
		executor:   executor.NewExecutor(),
		pathLooker: util.NewPathLooker(),
		scanner:    pydeps.NewDependencyScanner(log),
		pythonPath: pythonPath,
		log:        log,
	}
}

// InspectPython inspects the specified project directory,
// returning a Python configuration.
// If requirements.txt does not exist, it will be created.
// The python version (and packages if needed) will
// be determined by the specified pythonExecutable,
// or by `python3` or `python` on $PATH.
func (i *defaultPythonInspector) InspectPython(base util.Path) (*config.Python, error) {
	version, err := i.getPythonVersionFromFile(base)
	if err != nil {
		return nil, err
	}
	if version == "" {
		version, err = i.getPythonVersionFromExecutable()
		if err != nil {
			return nil, err
		}
	}
	return &config.Python{
		Version:        version,
		PackageFile:    PythonRequirementsFilename,
		PackageManager: "pip",
	}, nil
}

func (i *defaultPythonInspector) validatePythonExecutable(pythonExecutable string) error {
	args := []string{"--version"}
	_, err := i.executor.RunCommand(pythonExecutable, args, i.log)
	if err != nil {
		return fmt.Errorf("could not run python executable '%s': %w", pythonExecutable, err)
	}
	return nil
}

func (i *defaultPythonInspector) getPythonExecutable() (string, error) {
	if i.pythonPath.Path() != "" {
		// User-provided python executable
		exists, err := i.pythonPath.Exists()
		if err != nil {
			return "", err
		}
		if exists {
			return i.pythonPath.Path(), nil
		}
		return "", fmt.Errorf(
			"cannot find the specified Python executable %s: %w",
			i.pythonPath, fs.ErrNotExist)
	} else {
		// Use whatever is on PATH
		path, err := i.pathLooker.LookPath("python3")
		if err == nil {
			// Ensure the Python is actually runnable. This is especially
			// needed on Windows, where `python3` is (by default)
			// an app execution alias. Also, installing Python from
			// python.org does not disable the built-in app execution aliases.
			err = i.validatePythonExecutable(path)
		}
		if err != nil {
			path, err = i.pathLooker.LookPath("python")
			if err == nil {
				err = i.validatePythonExecutable(path)
			}
		}
		if err != nil {
			return "", err
		}
		return path, nil
	}
}

var fullVersionRE = regexp.MustCompile(`^\d+\.\d+\.\d+`)
var majorMinorVersionRE = regexp.MustCompile(`^\d+\.\d+`)
var errInvalidPythonVersionFile = errors.New("the .python-version file contains an invalid version; expected the format x.y or x.y.z")

func (i *defaultPythonInspector) getPythonVersionFromFile(base util.Path) (string, error) {
	dir := base
	for {
		version, err := i.readPythonVersionFile(dir)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				// Look up from here
				continue
			} else {
				return "", err
			}
		}
		if version != "" {
			return version, err
		}
		nextDir := dir.Dir()
		if nextDir == dir {
			// Nowhere to go from here
			return "", nil
		}
		dir = nextDir
	}
}

func (i *defaultPythonInspector) readPythonVersionFile(dir util.Path) (string, error) {
	versionFile := dir.Join(".python-version")
	contents, err := versionFile.ReadFile()
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	version := strings.TrimSpace(string(contents))
	i.log.Info("Python version from .python-version file", "version", version)

	if fullVersionRE.MatchString(version) {
		return version, nil
	} else if majorMinorVersionRE.MatchString(version) {
		return version + ".0", nil
	} else {
		return "", errInvalidPythonVersionFile
	}
}

func (i *defaultPythonInspector) getPythonVersionFromExecutable() (string, error) {
	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return "", err
	}
	i.log.Info("Getting Python version", "python", pythonExecutable)
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, err := i.executor.RunCommand(pythonExecutable, args, i.log)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	i.log.Info("Detected Python", "version", version)
	return version, nil
}

func (i *defaultPythonInspector) miniFreeze(base util.Path, pythonExecutable string, dest util.Path) error {
	specs, err := i.scanner.ScanDependencies(base, pythonExecutable)
	if err != nil {
		return err
	}
	f, err := dest.Create()
	if err != nil {
		return err
	}
	defer f.Close()

	for _, spec := range specs {
		_, err = fmt.Fprintln(f, spec)
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *defaultPythonInspector) CreateRequirementsFile(base util.Path, dest util.Path) error {
	oldWD, err := util.Chdir(base.Path())
	if err != nil {
		return nil
	}
	defer util.Chdir(oldWD)

	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return err
	}
	err = i.miniFreeze(base, pythonExecutable, dest)
	if err != nil {
		return err
	}
	return nil
}
