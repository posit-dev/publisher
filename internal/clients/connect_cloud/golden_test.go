package connect_cloud

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/api_client/auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/require"
)

const fixtureDir = "../../../packages/connect-cloud-api/testdata"

// TestRecordGoldenFixtures records real HTTP interactions against a live
// Connect Cloud instance and writes them as JSON fixture files.
//
// Run with:
//
//	UPDATE_GOLDEN=1 CONNECT_CLOUD_TOKEN=<token> CONNECT_CLOUD_ACCOUNT_ID=<id> \
//	  go test -run TestRecordGoldenFixtures ./internal/clients/connect_cloud/
//
// Optional: CONNECT_CLOUD_ENVIRONMENT=staging (default), development, or production
func TestRecordGoldenFixtures(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate fixture files")
	}

	token := os.Getenv("CONNECT_CLOUD_TOKEN")
	require.NotEmpty(t, token, "CONNECT_CLOUD_TOKEN is required")

	accountID := os.Getenv("CONNECT_CLOUD_ACCOUNT_ID")
	require.NotEmpty(t, accountID, "CONNECT_CLOUD_ACCOUNT_ID is required")

	environment := resolveEnvironment(os.Getenv("CONNECT_CLOUD_ENVIRONMENT"))
	baseURL := getBaseURL(environment)
	timeout := 30 * time.Second
	log := logging.NewDiscardLogger()

	// Build the transport chain: base → auth → recorder
	realTransport := http_client.NewTransport()
	clientAuth := auth.NewPlainAuthenticator(fmt.Sprintf("Bearer %s", token))
	authTransport := http_client.NewAuthenticatedTransport(realTransport, clientAuth)
	recorder := &RecordingTransport{Base: authTransport, BaseURL: baseURL}

	rawHTTPClient := &http.Client{Timeout: timeout, Transport: recorder}
	httpClient := http_client.NewHTTPClientWithTransport(baseURL, rawHTTPClient)

	client := &ConnectCloudClient{client: httpClient, log: log}

	// Ensure fixture output directory exists.
	absFixtureDir, err := filepath.Abs(fixtureDir)
	require.NoError(t, err)
	require.NoError(t, os.MkdirAll(absFixtureDir, 0755))

	// --- Read-only endpoints (independent) ---

	t.Run("get_current_user", func(t *testing.T) {
		recorder.Fixtures = nil
		resp, err := client.GetCurrentUser()
		require.NoError(t, err)
		require.NotNil(t, resp)
		writeFixture(t, absFixtureDir, "get_current_user", recorder.Fixtures)
	})

	t.Run("get_accounts", func(t *testing.T) {
		recorder.Fixtures = nil
		resp, err := client.GetAccounts()
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotEmpty(t, resp.Data, "expected at least one account")
		writeFixture(t, absFixtureDir, "get_accounts", recorder.Fixtures)
	})

	t.Run("get_account", func(t *testing.T) {
		recorder.Fixtures = nil
		resp, err := client.getAccount(accountID)
		require.NoError(t, err)
		require.NotNil(t, resp)
		writeFixture(t, absFixtureDir, "get_account", recorder.Fixtures)
	})

	// --- Write sequence (dependent) ---

	t.Run("write_sequence", func(t *testing.T) {
		var contentID types.ContentID
		var revisionID string
		var publishLogChannel string

		t.Run("create_content", func(t *testing.T) {
			recorder.Fixtures = nil
			resp, err := client.createContent(&clienttypes.CreateContentRequest{
				ContentRequestBase: clienttypes.ContentRequestBase{
					Title:       "Golden Test Content",
					ContentType: clienttypes.ContentTypeQuarto,
				},
				AccountID: accountID,
			})
			require.NoError(t, err)
			require.NotNil(t, resp)
			contentID = resp.ID
			if resp.NextRevision != nil {
				revisionID = resp.NextRevision.ID
				publishLogChannel = resp.NextRevision.PublishLogChannel
			}
			writeFixture(t, absFixtureDir, "create_content", recorder.Fixtures)
		})

		require.NotEmpty(t, contentID, "create_content must succeed before continuing")

		t.Run("get_content", func(t *testing.T) {
			recorder.Fixtures = nil
			resp, err := client.getContent(contentID)
			require.NoError(t, err)
			require.NotNil(t, resp)
			writeFixture(t, absFixtureDir, "get_content", recorder.Fixtures)
		})

		t.Run("update_content", func(t *testing.T) {
			recorder.Fixtures = nil
			resp, err := client.updateContent(&clienttypes.UpdateContentRequest{
				ContentRequestBase: clienttypes.ContentRequestBase{
					Title:       "Golden Test Content Updated",
					ContentType: clienttypes.ContentTypeQuarto,
				},
				ContentID: contentID,
			})
			require.NoError(t, err)
			require.NotNil(t, resp)
			// Capture the new revision info from the update.
			if resp.NextRevision != nil {
				revisionID = resp.NextRevision.ID
				publishLogChannel = resp.NextRevision.PublishLogChannel
			}
			writeFixture(t, absFixtureDir, "update_content", recorder.Fixtures)
		})

		if revisionID != "" {
			t.Run("get_revision", func(t *testing.T) {
				recorder.Fixtures = nil
				resp, err := client.getRevision(revisionID)
				require.NoError(t, err)
				require.NotNil(t, resp)
				writeFixture(t, absFixtureDir, "get_revision", recorder.Fixtures)
			})
		} else {
			t.Log("skipping get_revision: no revision ID captured")
		}

		if publishLogChannel != "" {
			t.Run("get_authorization", func(t *testing.T) {
				recorder.Fixtures = nil
				resp, err := client.getAuthorization(&clienttypes.AuthorizationRequest{
					ResourceType: "content",
					ResourceID:   string(contentID),
					Permission:   "publish",
				})
				require.NoError(t, err)
				require.NotNil(t, resp)
				writeFixture(t, absFixtureDir, "get_authorization", recorder.Fixtures)
			})
		} else {
			t.Log("skipping get_authorization: no publish_log_channel captured")
		}

		t.Run("publish_content", func(t *testing.T) {
			recorder.Fixtures = nil
			err := client.publishContent(string(contentID))
			// publish_content may fail if no bundle was uploaded; record what we get.
			if err != nil {
				t.Logf("publish_content returned error (expected if no bundle uploaded): %v", err)
				// Still write the fixture if we got a response recorded.
				if len(recorder.Fixtures) > 0 {
					writeFixture(t, absFixtureDir, "publish_content", recorder.Fixtures)
				}
				return
			}
			writeFixture(t, absFixtureDir, "publish_content", recorder.Fixtures)
		})
	})
}

func resolveEnvironment(env string) types.CloudEnvironment {
	switch env {
	case "development":
		return types.CloudEnvironmentDevelopment
	case "production":
		return types.CloudEnvironmentProduction
	default:
		return types.CloudEnvironmentStaging
	}
}

// writeFixture redacts sensitive data and writes the first fixture to a JSON file.
func writeFixture(t *testing.T, dir, name string, fixtures []Fixture) {
	t.Helper()
	require.NotEmpty(t, fixtures, "no fixture recorded for %s", name)

	fixture := fixtures[0]
	redactFixture(&fixture)

	data, err := json.MarshalIndent(fixture, "", "  ")
	require.NoError(t, err)

	path := filepath.Join(dir, name+".json")
	require.NoError(t, os.WriteFile(path, append(data, '\n'), 0644))
	t.Logf("wrote %s", path)
}
