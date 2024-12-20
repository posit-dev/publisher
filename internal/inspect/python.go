package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PythonInspector interface {
	InspectPython() (*config.Python, error)
	ReadRequirementsFile(path util.AbsolutePath) ([]string, error)
	WriteRequirementsFile(dest util.AbsolutePath, reqs []string) error
	ScanRequirements(base util.AbsolutePath) ([]string, []string, string, error)
}

type defaultPythonInspector struct {
	executor   executor.Executor
	pathLooker util.PathLooker
	scanner    pydeps.DependencyScanner
	base       util.AbsolutePath
	pythonPath util.Path
	log        logging.Logger
}

var _ PythonInspector = &defaultPythonInspector{}

const PythonRequirementsFilename = "requirements.txt"

var pythonVersionCache = make(map[string]string)

type PythonInspectorFactory func(base util.AbsolutePath, pythonPath util.Path, log logging.Logger) PythonInspector

func NewPythonInspector(base util.AbsolutePath, pythonPath util.Path, log logging.Logger) PythonInspector {
	return &defaultPythonInspector{
		executor:   executor.NewExecutor(),
		pathLooker: util.NewPathLooker(),
		scanner:    pydeps.NewDependencyScanner(log),
		base:       base,
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
func (i *defaultPythonInspector) InspectPython() (*config.Python, error) {
	// Change into the project dir because the user might have
	// .python-version there or in a parent directory, which will
	// determine which Python version is run by pyenv.
	oldWD, err := util.Chdir(i.base.String())
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return nil, err
	}
	pythonVersion, err := i.getPythonVersion(pythonExecutable)
	if err != nil {
		return nil, err
	}
	err = i.warnIfNoRequirementsFile()
	if err != nil {
		return nil, err
	}
	return &config.Python{
		Version:        pythonVersion,
		PackageFile:    PythonRequirementsFilename,
		PackageManager: "pip",
	}, nil
}

func (i *defaultPythonInspector) validatePythonExecutable(pythonExecutable string) error {
	_, err := i.getPythonVersion(pythonExecutable)
	if err != nil {
		return fmt.Errorf("could not run python executable '%s': %w", pythonExecutable, err)
	}
	return nil
}

func (i *defaultPythonInspector) getPythonExecutable() (string, error) {
	rawPath := i.pythonPath.String()
	executableNames := []string{"python3", "python"}

	if rawPath != "" {
		if strings.ContainsRune(rawPath, os.PathSeparator) {
			// User-provided python executable
			exists, err := i.pythonPath.Exists()
			if err != nil {
				return "", err
			}
			if exists {
				return i.pythonPath.String(), nil
			}
			noExecErr := fmt.Errorf(
				"cannot find the specified Python executable %s: %w",
				i.pythonPath, fs.ErrNotExist)
			return "", types.NewAgentError(types.ErrorPythonExecNotFound, noExecErr, nil)
		} else {
			// Only the interpreter name was specified; look for it on PATH.
			executableNames = append([]string{rawPath}, executableNames...)
		}
	}
	// Find the executable on PATH
	var path string
	var err error

	i.log.Info("Looking for Python on PATH", "PATH", os.Getenv("PATH"))
	for _, executableName := range executableNames {
		path, err = i.pathLooker.LookPath(executableName)
		if err == nil {
			// Ensure the Python is actually runnable. This is especially
			// needed on Windows, where `python3` is (by default)
			// an app execution alias. Also, installing Python from
			// python.org does not disable the built-in app execution aliases.
			err = i.validatePythonExecutable(path)
			if err == nil {
				return path, nil
			}
		}
	}

	if errors.Is(err, exec.ErrNotFound) {
		return "", types.NewAgentError(types.ErrorPythonExecNotFound, err, nil)
	}

	return "", err
}

func (i *defaultPythonInspector) getPythonVersion(pythonExecutable string) (string, error) {
	if version, ok := pythonVersionCache[pythonExecutable]; ok {
		return version, nil
	}
	i.log.Info("Getting Python version", "python", pythonExecutable)
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, _, err := i.executor.RunCommand(pythonExecutable, args, i.base, i.log)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	i.log.Info("Detected Python", "version", version)

	// Cache interpreter version result, unless it's a pyenv shim
	// (where the real Python interpreter may vary from run to run)
	if !strings.Contains(pythonExecutable, "shims") {
		pythonVersionCache[pythonExecutable] = version
	}
	return version, nil
}

func (i *defaultPythonInspector) warnIfNoRequirementsFile() error {
	requirementsFilename := i.base.Join("requirements.txt")
	exists, err := requirementsFilename.Exists()
	if err != nil {
		return err
	}
	if exists {
		i.log.Info("Using Python packages", "source", requirementsFilename)
	} else {
		i.log.Warn("can't find requirements.txt")
	}
	return nil
}

func (i *defaultPythonInspector) ReadRequirementsFile(path util.AbsolutePath) ([]string, error) {
	content, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(content), "\n")
	commentRE := regexp.MustCompile(`^\s*(#.*)?$`)
	lines = slices.DeleteFunc(lines, func(line string) bool {
		return commentRE.MatchString(line)
	})
	return lines, nil
}

func (i *defaultPythonInspector) ScanRequirements(base util.AbsolutePath) ([]string, []string, string, error) {
	oldWD, err := util.Chdir(base.String())
	if err != nil {
		return nil, nil, "", err
	}
	defer util.Chdir(oldWD)

	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return nil, nil, "", err
	}
	specs, err := i.scanner.ScanDependencies(base, pythonExecutable)
	if err != nil {
		return nil, nil, "", err
	}
	reqs := make([]string, 0, len(specs))
	incomplete := []string{}

	for _, spec := range specs {
		reqs = append(reqs, spec.String())
		if spec.Version == "" {
			incomplete = append(incomplete, string(spec.Name))
		}
	}
	return reqs, incomplete, pythonExecutable, nil
}

func (i *defaultPythonInspector) WriteRequirementsFile(dest util.AbsolutePath, reqs []string) error {
	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return err
	}
	autogenComment := fmt.Sprintf("# requirements.txt auto-generated by Posit Publisher\n# using %s\n", pythonExecutable)
	contents := autogenComment + strings.Join(reqs, "\n") + "\n"

	err = dest.WriteFile([]byte(contents), 0666)
	if err != nil {
		return err
	}
	return nil
}
