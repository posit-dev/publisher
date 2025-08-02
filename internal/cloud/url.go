package cloud

// Copyright (C) 2025 by Posit Software, PBC.

import "github.com/posit-dev/publisher/internal/types"

func GetFrontendURL(env types.CloudEnvironment) string {
	switch env {
	case types.CloudEnvironmentDevelopment:
		return "https://dev.connect.posit.cloud"
	case types.CloudEnvironmentStaging:
		return "https://staging.connect.posit.cloud"
	default:
		return "https://connect.posit.cloud"
	}
}
