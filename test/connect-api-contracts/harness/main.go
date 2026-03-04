package main

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
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
type callRequest struct {
	Method     string            `json:"method"`
	ConnectURL string            `json:"connectUrl"`
	ApiKey     string            `json:"apiKey"`
	ContentID  string            `json:"contentId,omitempty"`
	BundleID   string            `json:"bundleId,omitempty"`
	TaskID     string            `json:"taskId,omitempty"`
	Body       json.RawMessage   `json:"body,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	BundleData string            `json:"bundleData,omitempty"` // base64
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
	case "TestAuthentication":
		user, err := client.TestAuthentication(log)
		if err != nil {
			return map[string]any{"user": nil, "error": map[string]string{"msg": err.Error()}}, err
		}
		return map[string]any{"user": user, "error": nil}, nil

	case "GetCurrentUser":
		return client.GetCurrentUser(log)

	case "CreateDeployment":
		var body connect.ConnectContent
		if req.Body != nil {
			if err := json.Unmarshal(req.Body, &body); err != nil {
				return nil, err
			}
		}
		id, err := client.CreateDeployment(&body, log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"contentId": id}, nil

	case "ContentDetails":
		var body connect.ConnectContent
		err := client.ContentDetails(types.ContentID(req.ContentID), &body, log)
		if err != nil {
			return nil, err
		}
		return body, nil

	case "UpdateDeployment":
		var body connect.ConnectContent
		if req.Body != nil {
			if err := json.Unmarshal(req.Body, &body); err != nil {
				return nil, err
			}
		}
		return nil, client.UpdateDeployment(types.ContentID(req.ContentID), &body, log)

	case "GetEnvVars":
		return client.GetEnvVars(types.ContentID(req.ContentID), log)

	case "SetEnvVars":
		return nil, client.SetEnvVars(types.ContentID(req.ContentID), config.Environment(req.Env), log)

	case "UploadBundle":
		data, err := base64.StdEncoding.DecodeString(req.BundleData)
		if err != nil {
			return nil, err
		}
		id, err := client.UploadBundle(types.ContentID(req.ContentID), bytes.NewReader(data), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"bundleId": id}, nil

	case "DeployBundle":
		id, err := client.DeployBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"taskId": id}, nil

	case "WaitForTask":
		if err := client.WaitForTask(types.TaskID(req.TaskID), log); err != nil {
			return nil, err
		}
		return map[string]any{"finished": true}, nil

	case "ValidateDeployment":
		return nil, client.ValidateDeployment(types.ContentID(req.ContentID), log)

	case "GetIntegrations":
		return client.GetIntegrations(log)

	case "GetSettings":
		tmpDir, err := os.MkdirTemp("", "harness-settings-")
		if err != nil {
			return nil, err
		}
		defer os.RemoveAll(tmpDir)
		cfg := &config.Config{Type: contenttypes.ContentType("python-fastapi")}
		base := util.NewAbsolutePath(tmpDir, afero.NewOsFs())
		return client.GetSettings(base, cfg, log)

	case "LatestBundleID":
		id, err := client.LatestBundleID(types.ContentID(req.ContentID), log)
		if err != nil {
			return nil, err
		}
		return map[string]any{"bundleId": id}, nil

	case "DownloadBundle":
		data, err := client.DownloadBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
		if err != nil {
			return nil, err
		}
		return base64.StdEncoding.EncodeToString(data), nil

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
	captured, _ := fetchCapturedRequests(req.ConnectURL)

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

	_ = io.Discard // keep import for potential future use
}
