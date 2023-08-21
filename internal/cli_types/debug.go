package cli_types

import "github.com/rstudio/connect-client/internal/debug"

// Copyright (C) 2023 by Posit Software, PBC.

type debugFlag []string

func (d debugFlag) AfterApply() error {
	debug.InitDebugLogging(d)
	return nil
}
