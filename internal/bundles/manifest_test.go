package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ManifestSuite struct {
	utiltest.Suite

	fs      afero.Fs
	cwd     string
	visited []string
}

func TestManifestSuite(t *testing.T) {
	suite.Run(t, new(ManifestSuite))
}

func (s *ManifestSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := os.Getwd()
	s.Nil(err)
	s.cwd = cwd
	s.fs.MkdirAll(cwd, 0700)
	s.visited = nil
}

func (s *ManifestSuite) TestNewManifest() {
	manifest := NewManifest()
	s.Equal(1, manifest.Version)
	s.Empty(manifest.Packages)
	s.Empty(manifest.Files)
}

func (s *ManifestSuite) TestAddFile() {
	manifest := NewManifest()
	manifest.AddFile("test.Rmd", []byte{0x00, 0x01, 0x02})
	manifest.AddFile("subdir/test.Rmd", []byte{0x03, 0x04, 0x05})
	s.Equal(manifest.Files, ManifestFileMap{
		"test.Rmd":        ManifestFile{Checksum: "000102"},
		"subdir/test.Rmd": ManifestFile{Checksum: "030405"},
	})
}

func (s *ManifestSuite) TestAddFile_UpdatesSiteCategory() {
	for _, siteConfigYml := range util.KnownSiteYmlConfigFiles {
		manifest := NewManifest()
		manifest.AddFile("test.Rmd", []byte{0x00, 0x01, 0x02})
		s.Equal(manifest.Files, ManifestFileMap{
			"test.Rmd": ManifestFile{Checksum: "000102"},
		})
		s.Equal(manifest.Metadata.ContentCategory, "")

		manifest.AddFile(siteConfigYml, []byte{0x03, 0x04, 0x05})
		s.Equal(manifest.Files, ManifestFileMap{
			"test.Rmd":    ManifestFile{Checksum: "000102"},
			siteConfigYml: ManifestFile{Checksum: "030405"},
		})
		s.Equal(manifest.Metadata.ContentCategory, "site")
	}
}

func (s *ManifestSuite) TestReadManifest() {
	manifestJson := `{"version": 1, "platform": "4.1.0"}`
	reader := strings.NewReader(manifestJson)
	manifest, err := ReadManifest(reader)
	s.Nil(err)
	s.Equal(&Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: PackageMap{},
		Files:    ManifestFileMap{},
	}, manifest)
}

func (s *ManifestSuite) TestReadManifestErr() {
	manifestJson := `{"version": "abc"}`
	reader := strings.NewReader(manifestJson)
	_, err := ReadManifest(reader)
	s.NotNil(err)
}

func (s *ManifestSuite) TestToJSON() {
	manifest := NewManifest()
	manifest.Metadata.AppMode = "static"
	manifest.Metadata.PrimaryHtml = "main.html"
	manifest.Metadata.Entrypoint = "main.html"

	manifest.AddFile("main.html", []byte{0x12, 0x34, 0x56})
	manifestJson, err := manifest.ToJSON()
	s.Nil(err)

	decodedManifest, err := ReadManifest(bytes.NewReader(manifestJson))
	s.Nil(err)
	s.Equal(manifest, decodedManifest)
}

func (s *ManifestSuite) TestNewManifestFromConfig() {
	hasParams := true
	cfg := &config.Config{
		Schema:        schema.ConfigSchemaURL,
		Type:          "python-dash",
		Entrypoint:    "app:myapp",
		Title:         "Super Title",
		Description:   "minimal description",
		HasParameters: &hasParams,
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
	}
	m := NewManifestFromConfig(cfg)
	s.Equal(&Manifest{
		Version:  1,
		Platform: "4.5.6",
		Metadata: Metadata{
			AppMode:       "python-dash",
			Entrypoint:    "app:myapp",
			HasParameters: true,
		},
		Python: &Python{
			Version: "3.4.5",
			PackageManager: &PythonPackageManager{
				Name:        "pip",
				PackageFile: "requirements.in",
				AllowUv:     config.BoolPtr(false),
			},
		},
		Quarto: &Quarto{
			Version: "1.2.3",
			Engines: []string{"jupyter"},
		},
		Packages: map[string]Package{},
		Files:    map[string]ManifestFile{},
	}, m)
}

func (s *ManifestSuite) TestNewManifestFromConfigWithJupyterOptions() {
	hasParams := true
	cfg := &config.Config{
		Schema:        schema.ConfigSchemaURL,
		Type:          "jupyter-notebook",
		Entrypoint:    "notebook.ipynb",
		Title:         "Some Notebook",
		HasParameters: &hasParams,
		Python: &config.Python{
			Version:        "3.4.5",
			PackageFile:    "requirements.in",
			PackageManager: "pip",
		},
		Jupyter: &config.Jupyter{
			HideAllInput: true,
		},
	}
	m := NewManifestFromConfig(cfg)
	s.Equal(&Manifest{
		Version: 1,
		Metadata: Metadata{
			AppMode:       "jupyter-static",
			Entrypoint:    "notebook.ipynb",
			HasParameters: true,
		},
		Python: &Python{
			Version: "3.4.5",
			PackageManager: &PythonPackageManager{
				Name:        "pip",
				PackageFile: "requirements.in",
				AllowUv:     config.BoolPtr(false),
			},
		},
		Jupyter: &Jupyter{
			HideAllInput:    true,
			HideTaggedInput: false,
		},
		Packages: map[string]Package{},
		Files:    map[string]ManifestFile{},
	}, m)
}

func (s *ManifestSuite) TestNewManifestFromConfigVersionRequirements() {
	cfg := &config.Config{
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
	}
	m := NewManifestFromConfig(cfg)
	s.Equal(&Manifest{
		Environment: &Environment{
			Python: &EnvironmentPython{
				Requires: ">=3.4.5",
			},
			R: &EnvironmentR{
				Requires: ">=4.5.6",
			},
		},
		Version: 1,
		Python: &Python{
			Version: "3.4.5",
			PackageManager: &PythonPackageManager{
				Name:        "pip",
				PackageFile: "requirements.in",
				AllowUv:     config.BoolPtr(false),
			},
		},
		Platform: "4.5.6",
		Packages: map[string]Package{},
		Files:    map[string]ManifestFile{},
	}, m)
}

func (s *ManifestSuite) TestNewManifestFromConfig_PythonPackageManagerVariants_JSON() {
	// Validate JSON output for package_manager cases: auto, pip, uv
	cases := []struct {
		name          string
		inputPM       string
		expectedName  string
		expectAllowUv *bool // nil means field should be omitted
	}{
		{name: "auto", inputPM: "auto", expectedName: "pip", expectAllowUv: nil},
		{name: "pip", inputPM: "pip", expectedName: "pip", expectAllowUv: config.BoolPtr(false)},
		{name: "uv", inputPM: "uv", expectedName: "uv", expectAllowUv: config.BoolPtr(true)},
		{name: "none", inputPM: "none", expectedName: "none", expectAllowUv: nil},
	}

	for _, tc := range cases {
		cfg := &config.Config{
			Type:       "python-fastapi",
			Entrypoint: "app:app",
			Python: &config.Python{
				Version:        "3.11",
				PackageFile:    "requirements.txt",
				PackageManager: tc.inputPM,
			},
		}
		m := NewManifestFromConfig(cfg)
		data, err := m.ToJSON()
		s.Require().NoError(err, tc.name)

		var root map[string]any
		s.Require().NoError(json.Unmarshal(data, &root), tc.name)

		py, ok := root["python"].(map[string]any)
		s.Require().True(ok, tc.name)
		pm, ok := py["package_manager"].(map[string]any)
		s.Require().True(ok, tc.name)

		s.Equal(tc.expectedName, pm["name"], tc.name)

		allowUvVal, allowUvExists := pm["allow_uv"]
		if tc.expectAllowUv == nil {
			s.False(allowUvExists, tc.name)
		} else {
			s.True(allowUvExists, tc.name)
			s.Equal(*tc.expectAllowUv, allowUvVal.(bool), tc.name)
		}
	}
}
