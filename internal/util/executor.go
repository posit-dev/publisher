package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"os/exec"
)

type Executor interface {
	RunCommand(pythonExecutable string, args []string) ([]byte, error)
}

type defaultExecutor struct{}

var _ Executor = &defaultExecutor{}

func NewExecutor() *defaultExecutor {
	return &defaultExecutor{}
}

func (e *defaultExecutor) RunCommand(executable string, args []string) ([]byte, error) {
	cmd := exec.Command(executable, args...)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		return nil, err
	}
	return stdout.Bytes(), nil
}
