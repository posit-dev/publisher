package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

type Account struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

type AccountListResponse struct {
	Data []Account `json:"data"`
}
