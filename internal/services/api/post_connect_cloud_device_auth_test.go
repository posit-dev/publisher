package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/stretchr/testify/mock"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type PostConnectCloudDeviceAuthSuite struct {
	utiltest.Suite
	log logging.Logger
	h   http.HandlerFunc
}

func TestPostConnectCloudDeviceAuthSuite(t *testing.T) {
	suite.Run(t, new(PostConnectCloudDeviceAuthSuite))
}

func (s *PostConnectCloudDeviceAuthSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostConnectCloudDeviceAuthSuite) SetupTest() {
	s.h = PostConnectCloudDeviceAuthHandlerFunc(s.log)
}

func (s *PostConnectCloudDeviceAuthSuite) TestPostConnectCloudDeviceAuth() {
	client := cloud_auth.NewMockClient()
	deviceAuthResult := cloud_auth.DeviceAuthResponse{
		DeviceCode:              "the_device_code",
		UserCode:                "the_user_code",
		VerificationURI:         "the_verification_uri",
		VerificationURIComplete: "the_verification_uri_complete",
		ExpiresIn:               1800,
		Interval:                5,
	}
	client.On("CreateDeviceAuth", mock.Anything).Return(&deviceAuthResult, nil)
	cloudAuthClientFactory = func(environment types.CloudEnvironment, log logging.Logger, timeout time.Duration) cloud_auth.APIClient {
		return client
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"POST",
		"/connect-cloud/device-auth",
		nil,
	)
	s.NoError(err)
	req.Header.Set("Cloud-Auth-Base-Url", "https://api.login.staging.posit.cloud")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusOK, result.StatusCode)
	respBody, _ := io.ReadAll(rec.Body)
	s.Equal("{\"deviceCode\":\"the_device_code\","+
		"\"userCode\":\"the_user_code\","+
		"\"verificationURIComplete\":\"the_verification_uri_complete\","+
		"\"interval\":5}\n",
		string(respBody))
}
