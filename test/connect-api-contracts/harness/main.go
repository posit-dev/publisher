// Copyright (C) 2026 by Posit Software, PBC.

// Harness is a lightweight HTTP server that wraps Publisher's internal Go
// Connect API client so that the TypeScript contract tests can exercise it.
// The contract tests send JSON requests to POST /call, specifying a method
// name and parameters; the harness delegates to the real Go client code and
// returns the result along with any HTTP requests captured by the mock
// Connect server. This lets us verify that the Go client produces the
// correct HTTP requests (method, path, headers, body) for every Connect API
// operation without running a real Connect instance.
//
// This harness exists only to support the connect-api-contracts test suite
// and will be removed once the Go API client is deprecated and replaced.
package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"

	"github.com/spf13/afero"
)

var log = logging.NewDiscardLogger()

// callRequest is the single request body for POST /call.
//
// Fields used per method:
//
//	Method, ConnectURL, ApiKey        — always required
//	Body                              — CreateDeployment, UpdateDeployment
//	ContentID                         — ContentDetails, UpdateDeployment, GetEnvVars, SetEnvVars,
//	                                    UploadBundle, DeployBundle, ValidateDeployment, LatestBundleID, DownloadBundle
//	BundleID                          — DeployBundle, DownloadBundle
//	TaskID                            — WaitForTask
//	Env                               — SetEnvVars
//	BundleData (base64)               — UploadBundle
type callRequest struct {
	Method     string            `json:"method"`
	ConnectURL string            `json:"connectUrl"`
	ApiKey     string            `json:"apiKey"`
	ContentID  string            `json:"contentId,omitempty"`
	BundleID   string            `json:"bundleId,omitempty"`
	TaskID     string            `json:"taskId,omitempty"`
	Body       json.RawMessage   `json:"body,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	BundleData string            `json:"bundleData,omitempty"`
}

// callResponse is returned by every harness call.
type callResponse struct {
	Status           string `json:"status"`
	Result           any    `json:"result,omitempty"`
	Error            string `json:"error,omitempty"`
	CapturedRequests []any  `json:"capturedRequests"`
}

func newClient(connectURL, apiKey string) (connect.APIClient, error) {
	account := &accounts.Account{
		URL:        connectURL,
		ApiKey:     apiKey,
		ServerType: server_type.ServerTypeConnect,
	}
	return connect.NewConnectClient(account, 30*time.Second, events.NewNullEmitter(), log)
}

// unmarshalBody decodes req.Body into target if present.
func unmarshalBody(raw json.RawMessage, target any) error {
	if raw != nil {
		return json.Unmarshal(raw, target)
	}
	return nil
}

// newTempSettings creates the temporary directory and config needed by GetSettings.
// The caller must call the returned cleanup function when done.
func newTempSettings() (util.AbsolutePath, *config.Config, func(), error) {
	tmpDir, err := os.MkdirTemp("", "harness-settings-")
	if err != nil {
		return util.AbsolutePath{}, nil, nil, err
	}
	cleanup := func() { os.RemoveAll(tmpDir) }
	cfg := &config.Config{Type: contenttypes.ContentType("python-fastapi")}
	base := util.NewAbsolutePath(tmpDir, afero.NewOsFs())
	return base, cfg, cleanup, nil
}

// clearMockRequests tells the mock server to forget all captured requests.
func clearMockRequests(mockURL string) error {
	req, err := http.NewRequest("DELETE", mockURL+"/__test__/requests", nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// fetchCapturedRequests reads captured requests from the mock server.
func fetchCapturedRequests(mockURL string) ([]any, error) {
	resp, err := http.Get(mockURL + "/__test__/requests")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var requests []any
	if err := json.NewDecoder(resp.Body).Decode(&requests); err != nil {
		return nil, err
	}
	return requests, nil
}

// dispatch calls the appropriate APIClient method and returns the result.
func dispatch(client connect.APIClient, req *callRequest) (any, error) {
	switch req.Method {

	// --- Authentication & User ---

	case "TestAuthentication": // no extra fields
		user, err := client.TestAuthentication(log)
		if err != nil {
			return map[string]any{"user": nil, "error": map[string]string{"msg": err.Error()}}, err
		}
		return map[string]any{"user": user, "error": nil}, nil

	case "GetCurrentUser": // no extra fields
		return client.GetCurrentUser(log)

	// --- Content CRUD ---

	case "CreateDeployment": // body
		var body connect.ConnectContent
		if err := unmarshalBody(req.Body, &body); err != nil {
			return nil, err
		}
		id, err := client.CreateDeployment(&body, log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"contentId": id}, nil

	case "ContentDetails": // contentId
		var body connect.ConnectContent
		err := client.ContentDetails(types.ContentID(req.ContentID), &body, log)
		if err != nil {
			return nil, err
		}
		return body, nil

	case "UpdateDeployment": // contentId, body
		var body connect.ConnectContent
		if err := unmarshalBody(req.Body, &body); err != nil {
			return nil, err
		}
		return nil, client.UpdateDeployment(types.ContentID(req.ContentID), &body, log)

	// --- Environment Variables ---

	case "GetEnvVars": // contentId
		return client.GetEnvVars(types.ContentID(req.ContentID), log)

	case "SetEnvVars": // contentId, env
		return nil, client.SetEnvVars(types.ContentID(req.ContentID), config.Environment(req.Env), log)

	// --- Bundles ---

	case "UploadBundle": // contentId, bundleData (base64)
		data, err := base64.StdEncoding.DecodeString(req.BundleData)
		if err != nil {
			return nil, err
		}
		id, err := client.UploadBundle(types.ContentID(req.ContentID), bytes.NewReader(data), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"bundleId": id}, nil

	case "LatestBundleID": // contentId
		id, err := client.LatestBundleID(types.ContentID(req.ContentID), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"bundleId": id}, nil

	case "DownloadBundle": // contentId, bundleId
		data, err := client.DownloadBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
		if err != nil {
			return nil, err
		}
		return base64.StdEncoding.EncodeToString(data), nil

	// --- Deployment & Tasks ---

	case "DeployBundle": // contentId, bundleId
		id, err := client.DeployBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"taskId": id}, nil

	case "WaitForTask": // taskId
		if err := client.WaitForTask(types.TaskID(req.TaskID), log); err != nil {
			return nil, err
		}
		return map[string]any{"finished": true}, nil

	case "ValidateDeployment": // contentId
		return nil, client.ValidateDeployment(types.ContentID(req.ContentID), log)

	// --- Server Info ---

	case "GetSettings": // no extra fields (uses temp dir internally)
		base, cfg, cleanup, err := newTempSettings()
		if err != nil {
			return nil, err
		}
		defer cleanup()
		return client.GetSettings(base, cfg, log)

	default:
		return nil, fmt.Errorf("unknown method: %s", req.Method)
	}
}

func handleCall(w http.ResponseWriter, r *http.Request) {
	var req callRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(w, callResponse{Status: "error", Error: err.Error()})
		return
	}

	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeResponse(w, callResponse{Status: "error", Error: err.Error()})
		return
	}

	// Clear captured requests on the mock before calling the method.
	if err := clearMockRequests(req.ConnectURL); err != nil {
		writeResponse(w, callResponse{Status: "error", Error: "failed to clear mock: " + err.Error()})
		return
	}

	result, err := dispatch(client, &req)

	// Fetch captured requests from the mock after the call.
	captured, captureErr := fetchCapturedRequests(req.ConnectURL)
	if captureErr != nil {
		fmt.Fprintf(os.Stderr, "warning: failed to fetch captured requests: %v\n", captureErr)
	}

	resp := callResponse{
		Status:           "success",
		Result:           result,
		CapturedRequests: captured,
	}
	if err != nil {
		resp.Status = "error"
		resp.Error = err.Error()
	}
	writeResponse(w, resp)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}

func writeResponse(w http.ResponseWriter, resp callResponse) {
	if resp.CapturedRequests == nil {
		resp.CapturedRequests = []any{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func main() {
	listen := flag.String("listen", "localhost:0", "Address to listen on")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /call", handleCall)

	ln, err := net.Listen("tcp", *listen)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("http://%s\n", ln.Addr().String())
	os.Stdout.Sync()

	if err := http.Serve(ln, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
