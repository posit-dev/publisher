package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

type DeviceAuthRequest struct {
	ClientID string `json:"client_id"`
	Scope    string `json:"scope"`
}

type UserAccountRoleAccount struct {
	Name string `json:"name"`
}

type UserAccountRole struct {
	Role    string                 `json:"role"`
	Account UserAccountRoleAccount `json:"account"`
}

type UserResponse struct {
	AccountRoles map[string]UserAccountRole `json:"account_roles"`
}
