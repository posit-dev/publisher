package events

const (
	AuthenticationFailedCode  ErrorCode = "authFailed"            // Couldn't authenticate to publishing server
	OperationTimedOutCode     ErrorCode = "timeout"               // HTTP request to publishing server timed out
	ServerError               ErrorCode = "serverError"           // HTTP 5xx code from publishing server
	VanityURLNotAvailableCode ErrorCode = "vanityURLNotAvailable" // Vanity URL already in use
	DeploymentNotFoundCode    ErrorCode = "deploymentNotFound"    // Could not find deployment to update
	UnknownErrorCode          ErrorCode = "unknown"               // Other (unknown) error

	// Server failed to deploy the bundle.
	// This will eventually need to become more specific
	// so we can give better guidance.
	DeploymentFailedCode ErrorCode = "deployFailed"
)
