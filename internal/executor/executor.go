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

// RunScript is helpful when running R scripts, they avoid needing to ensure that the contents of the script
// is fully escaped and quoted.
func (e *defaultExecutor) RunScript(executable string, args []string, script string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error) {
	log.Debug("Running script", "cmd", executable, "args", strings.Join(args, " "), "script", script)
	// Write script contents to a file, clean it up, and append to args
	tempFile, err := os.CreateTemp("", "*")

	// defer cleaning up
	cleanup := func() {
		tempFile.Close()
		os.Remove(tempFile.Name())
	}
	defer cleanup()

	if err != nil {
		return nil, nil, fmt.Errorf("failed to create temporary R script: %w", err)
	}

	tempFile.WriteString(script)
	tempFile.Sync()

	args = append(args, "-f", tempFile.Name())
	return e.RunCommand(executable, args, cwd, log)
}
