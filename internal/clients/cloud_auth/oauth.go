package cloud_auth

import "github.com/posit-dev/publisher/internal/types"

// Copyright (C) 2025 by Posit Software, PBC.

type TokenRequest struct {
	GrantType    string `json:"grant_type"`
	DeviceCode   string `json:"device_code"`
	RefreshToken string `json:"refresh_token"`
}

type TokenResponse struct {
	AccessToken  types.CloudAuthToken `json:"access_token"`
	RefreshToken string               `json:"refresh_token"`
	ExpiresIn    int                  `json:"expires_in"`
	TokenType    string               `json:"token_type"`
	Scope        string               `json:"scope"`
}
