package executor

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"os/exec"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
)

type Executor interface {
	RunCommand(executable string, args []string, log logging.Logger) ([]byte, []byte, error)
}

type defaultExecutor struct{}

var _ Executor = &defaultExecutor{}

func NewExecutor() *defaultExecutor {
	return &defaultExecutor{}
}

func (e *defaultExecutor) RunCommand(executable string, args []string, log logging.Logger) ([]byte, []byte, error) {
	log.Debug("Running command", "cmd", executable, "args", strings.Join(args, " "))
	cmd := exec.Command(executable, args...)
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
