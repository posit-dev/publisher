package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

type APIClient interface {
	GetCurrentUser() (*UserResponse, error)
	GetAccounts() (*AccountListResponse, error)
}
