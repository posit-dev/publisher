package events

// Copyright (C) 2023 by Posit Software, PBC.

const (
	AuthenticationFailedCode  ErrorCode = "authFailedErr"            // Couldn't authenticate to publishing server
	PermissionsCode           ErrorCode = "permissionErr"            // Server responded with 403 forbidden
	OperationTimedOutCode     ErrorCode = "timeoutErr"               // HTTP request to publishing server timed out
	ServerErrorCode           ErrorCode = "serverErr"                // HTTP 5xx code from publishing server
	VanityURLNotAvailableCode ErrorCode = "vanityURLNotAvailableErr" // Vanity URL already in use
	DeploymentNotFoundCode    ErrorCode = "deploymentNotFoundErr"    // Could not find deployment to update

	// Server failed to deploy the bundle.
	// This will eventually need to become more specific
	// so we can give better guidance.
	DeploymentFailedCode ErrorCode = "deployFailed"
)
