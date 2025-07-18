package cloud_auth

// Copyright (C) 2025 by Posit Software, PBC.

type APIClient interface {
	CreateDeviceAuth(DeviceAuthRequest) (*DeviceAuthResponse, error)
	ExchangeToken(TokenRequest) (*TokenResponse, error)
}
