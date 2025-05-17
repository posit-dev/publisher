package executor

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type Executor interface {
	RunCommand(executable string, args []string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error)
	RunScript(executable string, args []string, script string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error)
}

type defaultExecutor struct{}

var _ Executor = &defaultExecutor{}

func NewExecutor() *defaultExecutor {
	return &defaultExecutor{}
}

func (e *defaultExecutor) RunCommand(executable string, args []string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error) {
	log.Debug("Running command", "cmd", executable, "args", strings.Join(args, " "))
	cmd := exec.Command(executable, args...)
	cmd.Dir = cwd.String()
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	stderrBuf := new(bytes.Buffer)
	cmd.Stderr = stderrBuf
	err := cmd.Run()

	if err != nil {
		log.Error("Error running command", "command", executable, "error", err.Error())
		os.Stderr.Write(stderrBuf.Bytes())
	}
	return stdout.Bytes(), stderrBuf.Bytes(), err
}

// createTempRScript creates a temporary file with R code and returns the file path.
// The caller is responsible for removing the temporary file.
func createTempRScript(content string) (string, func(), error) {
	tempFile, err := os.CreateTemp("", "*")
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temporary R script: %w", err)
	}

	// Write the R code to the temporary file
	if _, err := tempFile.WriteString(content); err != nil {
		tempFile.Close()
		os.Remove(tempFile.Name())
		return "", nil, fmt.Errorf("failed to write to temporary R script: %w", err)
	}
	if err := tempFile.Sync(); err != nil {
		tempFile.Close()
		os.Remove(tempFile.Name())
		return "", nil, fmt.Errorf("failed to flush temporary R script to disk: %w", err)
	}

	// Return the file path and a cleanup function
	cleanup := func() {
		tempFile.Close()
		os.Remove(tempFile.Name())
	}
	return tempFile.Name(), cleanup, nil
}

func (e *defaultExecutor) RunScript(executable string, args []string, script string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error) {
	log.Debug("Running command", "cmd", executable, "args", strings.Join(args, " "), "script", script)

	// Write script contents to a file, clean it up, and append to args
	tempScriptPath, cleanup, scriptErr := createTempRScript(script)
	if scriptErr != nil {
		return nil, nil, scriptErr
	}
	defer cleanup()
	args = append(args, "-f", tempScriptPath)

	cmd := exec.Command(executable, args...)
	cmd.Dir = cwd.String()
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	stderrBuf := new(bytes.Buffer)
	cmd.Stderr = stderrBuf
	err := cmd.Run()

	if err != nil {
		log.Error("Error running command", "command", executable, "error", err.Error())
		os.Stderr.Write(stderrBuf.Bytes())
	}
	return stdout.Bytes(), stderrBuf.Bytes(), err
}
