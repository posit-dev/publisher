package connect

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/stretchr/testify/require"
)

func int32Ptr(v int32) *int32       { return &v }
func int64Ptr(v int64) *int64       { return &v }
func float64Ptr(v float64) *float64 { return &v }

// TestGenerateContentGoldenFiles writes ConnectContent JSON fixtures used by
// the TypeScript cross-language tests. Run with:
//
//	UPDATE_GOLDEN=1 go test -run TestGenerateContentGoldenFiles ./internal/clients/connect/
//
// The generated files live under extensions/vscode/src/bundler/testdata/content/.
func TestGenerateContentGoldenFiles(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate fixture files")
	}

	outDir := filepath.Join("..", "..", "..", "extensions", "vscode", "src", "bundler", "testdata", "content")
	require.NoError(t, os.MkdirAll(outDir, 0755))

	cases := map[string]*config.Config{
		"minimal": {
			Title:       "",
			Description: "",
		},
		"title-description": {
			Title:       "My Dashboard",
			Description: "Shows important metrics",
		},
		"runtime-full": {
			Title: "Runtime App",
			Connect: &config.Connect{
				Runtime: &config.ConnectRuntime{
					ConnectionTimeout:  int32Ptr(10),
					ReadTimeout:        int32Ptr(20),
					InitTimeout:        int32Ptr(30),
					IdleTimeout:        int32Ptr(40),
					MaxProcesses:       int32Ptr(5),
					MinProcesses:       int32Ptr(1),
					MaxConnsPerProcess: int32Ptr(50),
					LoadFactor:         float64Ptr(0.75),
				},
			},
		},
		"access-full": {
			Connect: &config.Connect{
				Access: &config.ConnectAccess{
					RunAs:            "rstudio-connect",
					RunAsCurrentUser: config.BoolPtr(true),
				},
			},
		},
		"kubernetes-full": {
			Connect: &config.Connect{
				Kubernetes: &config.ConnectKubernetes{
					MemoryRequest:                  int64Ptr(1024),
					MemoryLimit:                    int64Ptr(2048),
					CPURequest:                     float64Ptr(0.5),
					CPULimit:                       float64Ptr(2.0),
					AMDGPULimit:                    int64Ptr(1),
					NvidiaGPULimit:                 int64Ptr(2),
					ServiceAccountName:             "my-sa",
					DefaultImageName:               "my-image:latest",
					DefaultREnvironmentManagement:  config.BoolPtr(true),
					DefaultPyEnvironmentManagement: config.BoolPtr(false),
				},
			},
		},
		"all-sections": {
			Title:       "Full App",
			Description: "Everything configured",
			Connect: &config.Connect{
				Runtime: &config.ConnectRuntime{
					ConnectionTimeout: int32Ptr(15),
					InitTimeout:       int32Ptr(60),
					MaxProcesses:      int32Ptr(3),
				},
				Access: &config.ConnectAccess{
					RunAs:            "publisher",
					RunAsCurrentUser: config.BoolPtr(false),
				},
				Kubernetes: &config.ConnectKubernetes{
					MemoryRequest: int64Ptr(512),
					CPULimit:      float64Ptr(1.0),
				},
			},
		},
	}

	for name, cfg := range cases {
		content := ConnectContentFromConfig(cfg)
		data, err := json.MarshalIndent(content, "", "  ")
		require.NoError(t, err, name)

		path := filepath.Join(outDir, name+".json")
		require.NoError(t, os.WriteFile(path, append(data, '\n'), 0644), name)
		t.Logf("wrote %s", path)
	}
}
