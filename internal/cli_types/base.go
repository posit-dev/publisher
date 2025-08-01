package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/logging"

	"github.com/spf13/afero"
)

type CommonArgs struct {
	Verbose int    `short:"v" type:"counter" help:"Enable verbose logging. Use -vv or --verbose=2 for debug logging."`
	Profile string `help:"Enable CPU profiling" kong:"hidden"`
}

type Log interface {
	logging.Logger
}

type CLIContext struct {
	Fs     afero.Fs
	Logger logging.Logger
}

func NewCLIContext(fs afero.Fs, log logging.Logger) *CLIContext {
	return &CLIContext{
		Fs:     fs,
		Logger: log,
	}
}
