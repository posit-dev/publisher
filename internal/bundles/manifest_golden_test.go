package bundles

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/stretchr/testify/require"
)

// TestGenerateGoldenFiles writes manifest JSON fixtures used by the TypeScript
// cross-language tests. Run with:
//
//	UPDATE_GOLDEN=1 go test -run TestGenerateGoldenFiles ./internal/bundles/
//
// The generated files live under extensions/vscode/src/bundler/testdata/.
func TestGenerateGoldenFiles(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate fixture files")
	}

	outDir := filepath.Join("..", "..", "extensions", "vscode", "src", "bundler", "testdata")
	require.NoError(t, os.MkdirAll(outDir, 0755))

	cases := map[string]*config.Config{
		"python-dash-full": {
			Schema:        schema.ConfigSchemaURL,
			Type:          "python-dash",
			Entrypoint:    "app:myapp",
			Title:         "Super Title",
			Description:   "minimal description",
			HasParameters: config.BoolPtr(true),
			Python: &config.Python{
				Version:        "3.4.5",
				PackageFile:    "requirements.in",
				PackageManager: "pip",
			},
			R: &config.R{
				Version:        "4.5.6",
				PackageFile:    "renv.lock",
				PackageManager: "renv",
			},
			Quarto: &config.Quarto{
				Version: "1.2.3",
				Engines: []string{"jupyter"},
			},
		},
		"jupyter-notebook": {
			Schema:        schema.ConfigSchemaURL,
			Type:          "jupyter-notebook",
			Entrypoint:    "notebook.ipynb",
			Title:         "Some Notebook",
			HasParameters: config.BoolPtr(true),
			Python: &config.Python{
				Version:        "3.4.5",
				PackageFile:    "requirements.in",
				PackageManager: "pip",
			},
			Jupyter: &config.Jupyter{
				HideAllInput: true,
			},
		},
		"version-requirements": {
			Type:       "quarto-static",
			Entrypoint: "report.qmd",
			Python: &config.Python{
				Version:               "3.4.5",
				PackageFile:           "requirements.in",
				PackageManager:        "pip",
				RequiresPythonVersion: ">=3.4.5",
			},
			R: &config.R{
				Version:          "4.5.6",
				PackageFile:      "renv.lock",
				PackageManager:   "renv",
				RequiresRVersion: ">=4.5.6",
			},
		},
		"integration-requests": {
			Schema:     schema.ConfigSchemaURL,
			Type:       "python-fastapi",
			Entrypoint: "app:app",
			Title:      "Test App",
			IntegrationRequests: []config.IntegrationRequest{
				{
					Guid:            "123456789abcdef",
					Name:            "my-integration",
					Description:     "Vertex AI OAuth integration",
					AuthType:        "Viewer",
					IntegrationType: "vertex-ai",
					Config: map[string]any{
						"auth_mode": "Confidential",
					},
				},
			},
		},
		"python-uv": {
			Type:       "python-fastapi",
			Entrypoint: "app:app",
			Python: &config.Python{
				Version:        "3.11",
				PackageFile:    "requirements.txt",
				PackageManager: "uv",
			},
		},
		"python-auto": {
			Type:       "python-fastapi",
			Entrypoint: "app:app",
			Python: &config.Python{
				Version:        "3.11",
				PackageFile:    "requirements.txt",
				PackageManager: "auto",
			},
		},
		"python-none": {
			Type:       "python-fastapi",
			Entrypoint: "app:app",
			Python: &config.Python{
				Version:        "3.11",
				PackageFile:    "requirements.txt",
				PackageManager: "none",
			},
		},
		"html-static": {
			Type:       "html",
			Entrypoint: "index.html",
		},
		"rmd-shiny": {
			Type:       "rmd-shiny",
			Entrypoint: "report.Rmd",
			R: &config.R{
				Version:        "4.3.1",
				PackageFile:    "renv.lock",
				PackageManager: "renv",
			},
		},
	}

	for name, cfg := range cases {
		m := NewManifestFromConfig(cfg)
		data, err := m.ToJSON()
		require.NoError(t, err, name)

		path := filepath.Join(outDir, name+".json")
		require.NoError(t, os.WriteFile(path, data, 0644), name)
		t.Logf("wrote %s", path)
	}
}
