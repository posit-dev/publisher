package cloud_auth

type DeviceAuthRequest struct {
	ClientID string `json:"client_id"`
	Scope    string `json:"scope"`
}

type DeviceAuthResult struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}
