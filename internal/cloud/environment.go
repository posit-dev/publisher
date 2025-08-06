package cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/types"
)

func GetCloudEnvironment(env string) types.CloudEnvironment {
	switch env {
	case "development":
		return types.CloudEnvironmentDevelopment
	case "staging":
		return types.CloudEnvironmentStaging
	default:
		return types.CloudEnvironmentProduction
	}
}
