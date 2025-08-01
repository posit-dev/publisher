package connect_cloud

import (
	"testing"

	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/assert"
)

func TestGetCloudUIURL(t *testing.T) {
	testCases := []struct {
		name     string
		apiURL   string
		expected string
	}{
		{
			name:     "production URL",
			apiURL:   "https://api.connect.posit.cloud",
			expected: "https://connect.posit.cloud",
		},
		{
			name:     "staging URL",
			apiURL:   "https://api.staging.connect.posit.cloud",
			expected: "https://staging.connect.posit.cloud",
		},
		{
			name:     "development URL",
			apiURL:   "https://api.dev.connect.posit.cloud",
			expected: "https://dev.connect.posit.cloud",
		},
		{
			name:     "URL without api subdomain",
			apiURL:   "https://connect.posit.cloud",
			expected: "https://connect.posit.cloud",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := getCloudUIURL(tc.apiURL)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetContentInfo(t *testing.T) {
	testCases := []struct {
		name               string
		apiURL             string
		orgName            string
		contentID          types.ContentID
		expectedDashboard  string
		expectedDirect     string
		expectedLogs       string
	}{
		{
			name:               "with specified organization",
			apiURL:             "https://api.connect.posit.cloud",
			orgName:            "test-org",
			contentID:          "abc123",
			expectedDashboard:  "https://connect.posit.cloud/test-org/content/abc123",
			expectedDirect:     "https://abc123.share.connect.posit.cloud",
			expectedLogs:       "https://connect.posit.cloud/test-org/content/abc123/logs",
		},
		{
			name:               "with default organization",
			apiURL:             "https://api.connect.posit.cloud",
			orgName:            "",
			contentID:          "xyz789",
			expectedDashboard:  "https://connect.posit.cloud/omar-org/content/xyz789",
			expectedDirect:     "https://xyz789.share.connect.posit.cloud",
			expectedLogs:       "https://connect.posit.cloud/omar-org/content/xyz789/logs",
		},
		{
			name:               "with staging URL",
			apiURL:             "https://api.staging.connect.posit.cloud",
			orgName:            "staging-org",
			contentID:          "def456",
			expectedDashboard:  "https://staging.connect.posit.cloud/staging-org/content/def456",
			expectedDirect:     "https://def456.share.connect.posit.cloud",
			expectedLogs:       "https://staging.connect.posit.cloud/staging-org/content/def456/logs",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create helper with account data
			helper := &publishhelper.PublishHelper{
				Account: &types.Account{
					URL:          tc.apiURL,
					Organization: tc.orgName,
				},
			}

			// Create the server publisher
			publisher := &ServerPublisher{
				State:  &state.State{},
				helper: helper,
			}

			// Call the method being tested
			info := publisher.GetContentInfo(tc.contentID)

			// Verify results
			assert.Equal(t, tc.contentID, info.ContentID)
			assert.Equal(t, tc.expectedDashboard, info.DashboardURL)
			assert.Equal(t, tc.expectedDirect, info.DirectURL)
			assert.Equal(t, tc.expectedLogs, info.LogsURL)
		})
	}
}