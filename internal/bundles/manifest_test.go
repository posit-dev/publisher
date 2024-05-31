package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
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
func (s *ManifestSuite) TestReadManifest() {
	manifestJson := `{"version": 1, "platform": "4.1.0"}`
	reader := strings.NewReader(manifestJson)
	manifest, err := ReadManifest(reader)
	s.Nil(err)
	s.Equal(&Manifest{
		Version:     1,
		Platform:    "4.1.0",
		Python:      &Python{},
		Quarto:      &Quarto{},
		Jupyter:     &Jupyter{},
		Environment: &Environment{},
		Packages:    PackageMap{},
		Files:       ManifestFileMap{},
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

func (s *ManifestSuite) TestReadManifestFile() {
	manifestJson := []byte(`{"version": 1, "platform": "4.1.0"}`)
	manifestPath := util.NewPath(ManifestFilename, afero.NewMemMapFs())
	err := manifestPath.WriteFile(manifestJson, 0600)
	s.Nil(err)

	manifest, err := ReadManifestFile(manifestPath)
	s.Nil(err)
	s.Equal(&Manifest{
		Version:     1,
		Platform:    "4.1.0",
		Python:      &Python{},
		Quarto:      &Quarto{},
		Jupyter:     &Jupyter{},
		Environment: &Environment{},
		Packages:    PackageMap{},
		Files:       ManifestFileMap{},
	}, manifest)
}

func (s *ManifestSuite) TestReadManifestFileErr() {
	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(nil, os.ErrNotExist)
	manifestPath := util.NewPath(ManifestFilename, fs)
	manifest, err := ReadManifestFile(manifestPath)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(manifest)
}

func (s *ManifestSuite) TestNewManifestFromConfig() {
	cfg := &config.Config{
		Schema:        schema.ConfigSchemaURL,
		Type:          "python-dash",
		Entrypoint:    "app:myapp",
		Title:         "Super Title",
		Description:   "minimal description",
		HasParameters: true,
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
			PackageManager: PythonPackageManager{
				Name:        "pip",
				PackageFile: "requirements.in",
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
