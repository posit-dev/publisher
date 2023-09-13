package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/rstudio/publishing-client/internal/util"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
	s.Nil(manifest.Python)
	s.Nil(manifest.Jupyter)
	s.Nil(manifest.Quarto)
	s.Nil(manifest.Environment)
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

func (s *ManifestSuite) TestReadManifestFile() {
	manifestJson := []byte(`{"version": 1, "platform": "4.1.0"}`)
	manifestPath := util.NewPath(ManifestFilename, afero.NewMemMapFs())
	err := manifestPath.WriteFile(manifestJson, 0600)
	s.Nil(err)

	manifest, err := ReadManifestFile(manifestPath)
	s.Nil(err)
	s.Equal(&Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: PackageMap{},
		Files:    ManifestFileMap{},
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

func (s *ManifestSuite) TestMergeEmpty() {
	orig := Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: PackageMap{},
		Files:    ManifestFileMap{},
		Metadata: Metadata{
			AppMode:         "python-fastapi",
			ContentCategory: "",
			Entrypoint:      "app.py",
			PrimaryRmd:      "rmd",
			PrimaryHtml:     "html",
			HasParameters:   false,
		},
	}
	added := Manifest{}
	merged := orig
	merged.Merge(&added)
	s.Equal(orig, merged)
}

func (s *ManifestSuite) TestMergeNonEmpty() {
	orig := Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: PackageMap{
			"shiny": Package{
				Source:     "source",
				Repository: "CRAN",
				Description: map[string]string{
					"field": "value",
				},
			},
		},
		Files: ManifestFileMap{
			"app.py": ManifestFile{
				Checksum: "abc123",
			},
		},
		Metadata: Metadata{
			AppMode:         "python-fastapi",
			ContentCategory: "",
			Entrypoint:      "app.py",
			PrimaryRmd:      "rmd",
			PrimaryHtml:     "html",
			HasParameters:   false,
		},
		Python: &Python{
			Version: "3.9.1",
			PackageManager: PythonPackageManager{
				Name:        "pip",
				Version:     "23.1.1",
				PackageFile: "requirements.txt",
			},
		},
		Jupyter: &Jupyter{
			HideAllInput:    false,
			HideTaggedInput: false,
		},
		Quarto: &Quarto{
			Version: "1.0.0",
			Engines: []string{"knitr"},
		},
		Environment: &Environment{
			Image:    "my-super-image",
			Prebuilt: false,
		},
	}
	added := Manifest{Version: 1,
		Platform: "4.1.0",
		Packages: PackageMap{
			"knitr": Package{
				Source:     "no",
				Repository: "CRAN",
				Description: map[string]string{
					"field": "value",
				},
			},
		},
		Files: ManifestFileMap{
			"app.py": ManifestFile{
				Checksum: "987654",
			},
		},
		Metadata: Metadata{
			AppMode:         "quarto-shiny",
			ContentCategory: "something",
			Entrypoint:      "app.py",
			PrimaryRmd:      "nope",
			PrimaryHtml:     "also no",
			HasParameters:   true,
		},
		Python: &Python{
			Version: "3.10.2",
			PackageManager: PythonPackageManager{
				Name:        "pip",
				Version:     "22.0.1",
				PackageFile: "requirements.txt",
			},
		},
		Jupyter: &Jupyter{
			HideAllInput:    true,
			HideTaggedInput: true,
		},
		Quarto: &Quarto{
			Version: "0.9.0",
			Engines: []string{"knitr"},
		},
		Environment: &Environment{
			Image:    "some-image",
			Prebuilt: true,
		},
	}
	merged := orig
	merged.Merge(&added)

	// Package list will contain both.
	s.Len(merged.Packages, 2)
	// Then drop it so we can do a single compare of the other fields.
	merged.Packages = added.Packages
	s.Equal(added, merged)
}

func (s *ManifestSuite) TestResetEmptyFieldsNonEmpty() {
	m := Manifest{
		Python: &Python{
			Version: "3.8.1",
		},
		Jupyter: &Jupyter{
			HideAllInput: true,
		},
		Quarto: &Quarto{
			Version: "0.9.0",
		},
		Environment: &Environment{
			Image: "my-image",
		},
	}
	orig := m
	m.ResetEmptyFields()
	s.Equal(orig, m)
}

func (s *ManifestSuite) TestResetEmptyFieldsNil() {
	m := Manifest{}
	orig := m
	m.ResetEmptyFields()
	s.Equal(orig, m)
}

func (s *ManifestSuite) TestResetEmptyFieldsEmpty() {
	m := Manifest{
		Python:      &Python{},
		Jupyter:     &Jupyter{},
		Quarto:      &Quarto{},
		Environment: &Environment{},
	}
	m.ResetEmptyFields()
	s.Nil(m.Python)
	s.Nil(m.Jupyter)
	s.Nil(m.Quarto)
	s.Nil(m.Environment)
}
