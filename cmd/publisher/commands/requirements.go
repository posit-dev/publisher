package commands

// Copyright (C) 2023 by Posit Software, PBC.

type RequirementsCommands struct {
	Create CreateRequirementsCommand `kong:"cmd" help:"Create a requirements.txt file from your project's dependencies and a Python installation containing the packages."`
	Show   ShowRequirementsCommand   `kong:"cmd" help:"Show your project's dependencies."`
}
