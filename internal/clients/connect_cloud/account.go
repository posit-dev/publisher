package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

type AccountEntitlement struct {
	Enabled bool `json:"enabled"`
}

type AccountEntitlements struct {
	AccountPrivateContentFlag AccountEntitlement `json:"account_private_content_flag"`
}

type AccountLicense struct {
	Entitlements AccountEntitlements `json:"entitlements"`
}

type Account struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	DisplayName string          `json:"display_name"`
	Permissions []string        `json:"permissions"`
	License     *AccountLicense `json:"license"`
}

type AccountListResponse struct {
	Data []Account `json:"data"`
}
