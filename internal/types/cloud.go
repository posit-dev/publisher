package types

// Copyright (C) 2025 by Posit Software, PBC.

type CloudEnvironment string

const (
	CloudEnvironmentDevelopment CloudEnvironment = "development"
	CloudEnvironmentStaging     CloudEnvironment = "staging"
	CloudEnvironmentProduction  CloudEnvironment = "production"
)

type CloudAuthToken string
