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

// newClient creates a fresh ConnectClient for each request.
func newClient(connectURL, apiKey string) (connect.APIClient, error) {
	account := &accounts.Account{
		URL:        connectURL,
		ApiKey:     apiKey,
		ServerType: server_type.ServerTypeConnect,
	}
	return connect.NewConnectClient(account, 30*time.Second, events.NewNullEmitter(), log)
}

// harnessResponse is the envelope returned by every harness endpoint.
type harnessResponse struct {
	Status string `json:"status"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeSuccess(w http.ResponseWriter, result any) {
	writeJSON(w, http.StatusOK, harnessResponse{Status: "success", Result: result})
}

func writeError(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusOK, harnessResponse{Status: "error", Error: err.Error()})
}

func decodeBody(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// --- Request structs ---

type baseRequest struct {
	ConnectURL string `json:"connectUrl"`
	ApiKey     string `json:"apiKey"`
}

type contentRequest struct {
	baseRequest
	ContentID string `json:"contentId"`
}

type bodyRequest struct {
	baseRequest
	Body json.RawMessage `json:"body"`
}

type contentBodyRequest struct {
	contentRequest
	Body json.RawMessage `json:"body"`
}

type envRequest struct {
	contentRequest
	Env map[string]string `json:"env"`
}

type bundleDataRequest struct {
	contentRequest
	BundleData string `json:"bundleData"` // base64
}

type bundleIDRequest struct {
	contentRequest
	BundleID string `json:"bundleId"`
}

type taskRequest struct {
	baseRequest
	TaskID string `json:"taskId"`
}

// --- Handlers ---

func handleTestAuthentication(w http.ResponseWriter, r *http.Request) {
	var req baseRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	user, err := client.TestAuthentication(log)
	if err != nil {
		writeJSON(w, http.StatusOK, harnessResponse{
			Status: "error",
			Result: map[string]any{"user": nil, "error": map[string]string{"msg": err.Error()}},
		})
		return
	}
	writeSuccess(w, map[string]any{"user": user, "error": nil})
}

func handleGetCurrentUser(w http.ResponseWriter, r *http.Request) {
	var req baseRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	user, err := client.GetCurrentUser(log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, user)
}

func handleCreateDeployment(w http.ResponseWriter, r *http.Request) {
	var req bodyRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	var body connect.ConnectContent
	if req.Body != nil {
		if err := json.Unmarshal(req.Body, &body); err != nil {
			writeError(w, err)
			return
		}
	}
	contentID, err := client.CreateDeployment(&body, log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, map[string]any{"contentId": contentID})
}

func handleContentDetails(w http.ResponseWriter, r *http.Request) {
	var req contentRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	var body connect.ConnectContent
	err = client.ContentDetails(types.ContentID(req.ContentID), &body, log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, body)
}

func handleUpdateDeployment(w http.ResponseWriter, r *http.Request) {
	var req contentBodyRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	var body connect.ConnectContent
	if req.Body != nil {
		if err := json.Unmarshal(req.Body, &body); err != nil {
			writeError(w, err)
			return
		}
	}
	err = client.UpdateDeployment(types.ContentID(req.ContentID), &body, log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, nil)
}

func handleGetEnvVars(w http.ResponseWriter, r *http.Request) {
	var req contentRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	env, err := client.GetEnvVars(types.ContentID(req.ContentID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, env)
}

func handleSetEnvVars(w http.ResponseWriter, r *http.Request) {
	var req envRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	err = client.SetEnvVars(types.ContentID(req.ContentID), config.Environment(req.Env), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, nil)
}

func handleUploadBundle(w http.ResponseWriter, r *http.Request) {
	var req bundleDataRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	data, err := base64.StdEncoding.DecodeString(req.BundleData)
	if err != nil {
		writeError(w, err)
		return
	}
	bundleID, err := client.UploadBundle(types.ContentID(req.ContentID), bytes.NewReader(data), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, map[string]any{"bundleId": bundleID})
}

func handleDeployBundle(w http.ResponseWriter, r *http.Request) {
	var req bundleIDRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	taskID, err := client.DeployBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, map[string]any{"taskId": taskID})
}

func handleWaitForTask(w http.ResponseWriter, r *http.Request) {
	var req taskRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	err = client.WaitForTask(types.TaskID(req.TaskID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, map[string]any{"finished": true})
}

func handleValidateDeployment(w http.ResponseWriter, r *http.Request) {
	var req contentRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	err = client.ValidateDeployment(types.ContentID(req.ContentID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, nil)
}

func handleGetIntegrations(w http.ResponseWriter, r *http.Request) {
	var req baseRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	integrations, err := client.GetIntegrations(log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, integrations)
}

func handleGetSettings(w http.ResponseWriter, r *http.Request) {
	var req baseRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	// Use a minimal config and temp dir, since the tests only care about
	// which Connect endpoints are called and that responses parse.
	tmpDir, err := os.MkdirTemp("", "harness-settings-")
	if err != nil {
		writeError(w, err)
		return
	}
	defer os.RemoveAll(tmpDir)

	cfg := &config.Config{
		Type: contenttypes.ContentType("python-fastapi"),
	}
	base := util.NewAbsolutePath(tmpDir, afero.NewOsFs())
	settings, err := client.GetSettings(base, cfg, log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, settings)
}

func handleLatestBundleID(w http.ResponseWriter, r *http.Request) {
	var req contentRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	bundleID, err := client.LatestBundleID(types.ContentID(req.ContentID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, map[string]any{"bundleId": bundleID})
}

func handleDownloadBundle(w http.ResponseWriter, r *http.Request) {
	var req bundleIDRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err)
		return
	}
	client, err := newClient(req.ConnectURL, req.ApiKey)
	if err != nil {
		writeError(w, err)
		return
	}
	data, err := client.DownloadBundle(types.ContentID(req.ContentID), types.BundleID(req.BundleID), log)
	if err != nil {
		writeError(w, err)
		return
	}
	writeSuccess(w, base64.StdEncoding.EncodeToString(data))
}

func main() {
	listen := flag.String("listen", "localhost:0", "Address to listen on")
	_ = flag.String("mock-connect-url", "", "URL of mock Connect server (unused, Connect URL comes per-request)")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /test-authentication", handleTestAuthentication)
	mux.HandleFunc("POST /get-current-user", handleGetCurrentUser)
	mux.HandleFunc("POST /create-deployment", handleCreateDeployment)
	mux.HandleFunc("POST /content-details", handleContentDetails)
	mux.HandleFunc("POST /update-deployment", handleUpdateDeployment)
	mux.HandleFunc("POST /get-env-vars", handleGetEnvVars)
	mux.HandleFunc("POST /set-env-vars", handleSetEnvVars)
	mux.HandleFunc("POST /upload-bundle", handleUploadBundle)
	mux.HandleFunc("POST /deploy-bundle", handleDeployBundle)
	mux.HandleFunc("POST /wait-for-task", handleWaitForTask)
	mux.HandleFunc("POST /validate-deployment", handleValidateDeployment)
	mux.HandleFunc("POST /get-integrations", handleGetIntegrations)
	mux.HandleFunc("POST /get-settings", handleGetSettings)
	mux.HandleFunc("POST /latest-bundle-id", handleLatestBundleID)
	mux.HandleFunc("POST /download-bundle", handleDownloadBundle)

	ln, err := net.Listen("tcp", *listen)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}

	// Print the URL to stdout so setup.ts can capture it (same pattern as publisher binary).
	fmt.Printf("http://%s\n", ln.Addr().String())

	// Ensure stdout is flushed
	os.Stdout.Sync()

	if err := http.Serve(ln, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}

}
