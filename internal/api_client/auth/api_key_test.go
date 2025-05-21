package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"net/http"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ApiKeyAuthSuite struct {
	utiltest.Suite
}

func TestApiKeyAuthSuite(t *testing.T) {
	suite.Run(t, new(ApiKeyAuthSuite))
}

func (s *ApiKeyAuthSuite) TestAddAuthHeaders() {
	for name, test := range map[string]struct {
		headerName string

		expectedHeader string
	}{
		"default header": {
			headerName:     "",
			expectedHeader: "Authorization",
		},
		"custom header": {
			headerName:     "X-Custom",
			expectedHeader: "X-Custom",
		},
	} {
		key := "test-key"
		auth := NewApiKeyAuthenticator(key, test.headerName)

		req, err := http.NewRequest("GET", "", nil)
		s.NoError(err, name)

		req.Header.Add("X-Existing", "unchanged")

		err = auth.AddAuthHeaders(req)
		s.NoError(err, name)

		s.Equal(http.Header{
			"X-Existing": []string{"unchanged"},
			test.expectedHeader: []string{
				"Key " + key,
			},
		}, req.Header, name)
	}
}
