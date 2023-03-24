package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
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
	s.Equal(manifest.Files, FileMap{
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
		Files:    FileMap{},
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
	manifest.Metadata.EntryPoint = "main.html"

	manifest.AddFile("main.html", []byte{0x12, 0x34, 0x56})
	manifestJson, err := manifest.ToJSON()
	s.Nil(err)

	decodedManifest, err := ReadManifest(bytes.NewReader(manifestJson))
	s.Nil(err)
	s.Equal(manifest, decodedManifest)
}

func (s *ManifestSuite) TestReadManifestFile() {
	manifestJson := []byte(`{"version": 1, "platform": "4.1.0"}`)
	filename := "manifest.json"

	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, manifestJson, 0600)
	s.Nil(err)

	manifest, err := ReadManifestFile(fs, filename)
	s.Nil(err)
	s.Equal(&Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: PackageMap{},
		Files:    FileMap{},
	}, manifest)
}

func (s *ManifestSuite) TestReadManifestFileErr() {
	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(nil, os.ErrNotExist)
	manifest, err := ReadManifestFile(fs, "manifest.json")
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(manifest)
}
