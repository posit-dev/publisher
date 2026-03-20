package connect_cloud

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// loadFixture reads and parses a fixture JSON file from the testdata directory.
func loadFixture(t *testing.T, name string) *Fixture {
	t.Helper()
	absDir, err := filepath.Abs(fixtureDir)
	require.NoError(t, err)
	path := filepath.Join(absDir, name+".json")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		t.Skipf("fixture file %s not found; run golden recorder first", path)
	}
	require.NoError(t, err)

	var f Fixture
	require.NoError(t, json.Unmarshal(data, &f))
	return &f
}

// newReplayClient creates a ConnectCloudClient backed by an httptest.Server
// that returns the fixture's response.
func newReplayClient(t *testing.T, fixture *Fixture) (*ConnectCloudClient, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(fixture.StatusCode)
		if fixture.ResponseBody != nil {
			_, err := w.Write(fixture.ResponseBody)
			if err != nil {
				t.Errorf("failed to write response body: %v", err)
			}
		}
	}))

	httpClient := http_client.NewBasicHTTPClient(server.URL, 0)
	log := logging.NewDiscardLogger()
	client := &ConnectCloudClient{client: httpClient, log: log}
	return client, server
}

func TestReplayGetCurrentUser(t *testing.T) {
	fixture := loadFixture(t, "get_current_user")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	resp, err := client.GetCurrentUser()
	require.NoError(t, err)
	require.NotNil(t, resp)

	// Verify it round-trips: marshal the response and compare to fixture.
	roundTripped, err := json.Marshal(resp)
	require.NoError(t, err)
	assert.JSONEq(t, string(fixture.ResponseBody), string(roundTripped))
}

func TestReplayGetAccounts(t *testing.T) {
	fixture := loadFixture(t, "get_accounts")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	resp, err := client.GetAccounts()
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotEmpty(t, resp.Data)

	roundTripped, err := json.Marshal(resp)
	require.NoError(t, err)
	assert.JSONEq(t, string(fixture.ResponseBody), string(roundTripped))
}

func TestReplayGetAccount(t *testing.T) {
	fixture := loadFixture(t, "get_account")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	// Extract the account ID from the fixture response.
	var account Account
	require.NoError(t, json.Unmarshal(fixture.ResponseBody, &account))

	resp, err := client.getAccount(account.ID)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, account.ID, resp.ID)
}

func TestReplayGetContent(t *testing.T) {
	fixture := loadFixture(t, "get_content")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	// Extract the content ID from the fixture response.
	var content clienttypes.ContentResponse
	require.NoError(t, json.Unmarshal(fixture.ResponseBody, &content))

	resp, err := client.getContent(content.ID)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, content.ID, resp.ID)
}

func TestReplayCreateContent(t *testing.T) {
	fixture := loadFixture(t, "create_content")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	// Parse the request body to reconstruct the create request.
	var reqBody clienttypes.CreateContentRequest
	require.NoError(t, json.Unmarshal(fixture.RequestBody, &reqBody))

	resp, err := client.createContent(&reqBody)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, string(resp.ID))
}

func TestReplayUpdateContent(t *testing.T) {
	fixture := loadFixture(t, "update_content")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	resp, err := client.updateContent(&clienttypes.UpdateContentRequest{
		ContentRequestBase: clienttypes.ContentRequestBase{
			Title:       "test",
			ContentType: clienttypes.ContentTypeQuarto,
		},
		ContentID: types.ContentID("test-id"),
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, string(resp.ID))
}

func TestReplayGetRevision(t *testing.T) {
	fixture := loadFixture(t, "get_revision")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	resp, err := client.getRevision("test-revision-id")
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.ID)
}

func TestReplayGetAuthorization(t *testing.T) {
	fixture := loadFixture(t, "get_authorization")
	client, server := newReplayClient(t, fixture)
	defer server.Close()

	resp, err := client.getAuthorization(&clienttypes.AuthorizationRequest{
		ResourceType: "content",
		ResourceID:   "test-content-id",
		Permission:   "publish",
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.True(t, resp.Authorized)
}

func TestReplayPublishContent(t *testing.T) {
	fixture := loadFixture(t, "publish_content")
	if fixture.StatusCode < 200 || fixture.StatusCode >= 300 {
		t.Skipf("publish_content fixture has non-success status %d; skipping", fixture.StatusCode)
	}

	// publish_content returns no body on success (204), so we need a special server.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(fixture.StatusCode)
		if fixture.ResponseBody != nil {
			_, _ = w.Write(fixture.ResponseBody)
		}
	}))
	defer server.Close()

	httpClient := http_client.NewBasicHTTPClient(server.URL, 0)
	log := logging.NewDiscardLogger()
	client := &ConnectCloudClient{client: httpClient, log: log}

	err := client.publishContent("test-content-id")
	require.NoError(t, err)
}

// TestReplayAllFixturesDeserialize is a catch-all test that ensures every
// fixture file in testdata/ can be loaded and its response body is valid JSON.
func TestReplayAllFixturesDeserialize(t *testing.T) {
	absDir, err := filepath.Abs(fixtureDir)
	require.NoError(t, err)

	entries, err := os.ReadDir(absDir)
	if os.IsNotExist(err) {
		t.Skip("testdata directory not found; run golden recorder first")
	}
	require.NoError(t, err)

	found := false
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		found = true
		name := entry.Name()
		t.Run(name, func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join(absDir, name))
			require.NoError(t, err)

			var f Fixture
			require.NoError(t, json.Unmarshal(data, &f), "fixture should be valid JSON")
			assert.NotEmpty(t, f.Method, "method should be set")
			assert.NotEmpty(t, f.Path, "path should be set")
			assert.Greater(t, f.StatusCode, 0, "status_code should be positive")

			if f.ResponseBody != nil {
				assert.True(t, json.Valid(f.ResponseBody),
					fmt.Sprintf("response_body should be valid JSON in %s", name))
			}
		})
	}
	if !found {
		t.Skip("no fixture JSON files found; run golden recorder first")
	}
}
