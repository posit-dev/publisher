package api

// Copyright (C) 2025 by Posit Software, PBC.
import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PostConnectCloudOAuthTokenSuite struct {
	utiltest.Suite
	log logging.Logger
	h   http.HandlerFunc
}

func TestPostConnectCloudOAuthTokenSuite(t *testing.T) {
	suite.Run(t, new(PostConnectCloudOAuthTokenSuite))
}

func (s *PostConnectCloudOAuthTokenSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostConnectCloudOAuthTokenSuite) SetupTest() {
	s.h = PostConnectCloudOAuthTokenHandlerFunc(s.log)
}

func (s *PostConnectCloudOAuthTokenSuite) TestPostConnectCloudOAuthToken() {
	client := cloud_auth.NewMockClient()
	deviceAuthResult := cloud_auth.TokenResponse{
		AccessToken:  "the_access_token",
		RefreshToken: "the_refresh_token",
		ExpiresIn:    3600,
		TokenType:    "Bearer",
		Scope:        "vivid",
	}
	client.On("ExchangeToken", mock.Anything).Return(&deviceAuthResult, nil)
	cloudAuthClientFactory = func(baseURL string, log logging.Logger, timeout time.Duration) cloud_auth.APIClient {
		return client
	}

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"deviceCode": "the_device_code"}`)
	req, err := http.NewRequest(
		"POST",
		"/connect-cloud/oauth/token",
		body,
	)
	s.NoError(err)
	req.Header.Set("Cloud-Auth-Base-Url", "https://api.login.staging.posit.cloud")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusOK, result.StatusCode)
	respBody, _ := io.ReadAll(rec.Body)
	s.Equal("{\"accessToken\":\"the_access_token\",\"refreshToken\":\"the_refresh_token\",\"expiresIn\":3600}\n", string(respBody))
}

func (s *PostConnectCloudOAuthTokenSuite) TestPostConnectCloudOAuthToken_BadRequestMappedError() {
	tests := []struct {
		name            string
		errorCode       string
		expectedAPICode string
	}{
		{
			name:            "authorization_pending error",
			errorCode:       "authorization_pending",
			expectedAPICode: "deviceAuthPending",
		},
		{
			name:            "slow_down error",
			errorCode:       "slow_down",
			expectedAPICode: "deviceAuthSlowDown",
		},
		{
			name:            "access_denied error",
			errorCode:       "access_denied",
			expectedAPICode: "deviceAuthAccessDenied",
		},
		{
			name:            "expired_token error",
			errorCode:       "expired_token",
			expectedAPICode: "deviceAuthExpiredToken",
		},
		{
			name:            "unknown error",
			errorCode:       "blah",
			expectedAPICode: "unknown",
		},
	}

	for _, tc := range tests {
		s.Run(tc.name, func() {
			log := logging.New()

			client := cloud_auth.NewMockClient()
			resultErr := types.NewAgentError(
				events.ServerErrorCode,
				http_client.NewHTTPError("https://foo.bar", "POST", http.StatusBadRequest, "uh oh"),
				map[string]interface{}{"error": tc.errorCode})
			client.On("ExchangeToken", mock.Anything).Return(nil, resultErr)
			cloudAuthClientFactory = func(baseURL string, log logging.Logger, timeout time.Duration) cloud_auth.APIClient {
				return client
			}

			rec := httptest.NewRecorder()
			body := strings.NewReader(`{"deviceCode": "the_device_code"}`)
			req, err := http.NewRequest(
				"POST",
				"/connect-cloud/oauth/token",
				body,
			)
			s.NoError(err)
			req.Header.Set("Cloud-Auth-Base-Url", "https://api.login.staging.posit.cloud")

			handler := PostConnectCloudOAuthTokenHandlerFunc(log)
			handler(rec, req)

			result := rec.Result()
			s.Equal(http.StatusBadRequest, result.StatusCode)
			respBody, _ := io.ReadAll(rec.Body)
			s.Equal(fmt.Sprintf("{\"code\":\"%s\"}\n", tc.expectedAPICode), string(respBody))
		})
	}
}

func (s *PostConnectCloudOAuthTokenSuite) TestPostConnectCloudOAuthToken_MissingBaseURL() {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"deviceCode": "the_device_code"}`)
	req, err := http.NewRequest(
		"POST",
		"/connect-cloud/oauth/token",
		body,
	)
	s.NoError(err)
	// Intentionally not setting Cloud-Auth-Base-Url header

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusBadRequest, result.StatusCode)
}
