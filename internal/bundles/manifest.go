package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/spf13/afero"
)

// ManifestFilename is the well-known manifest.json filename contained within
// deployment bundles.
const ManifestFilename = "manifest.json"

// Manifest contains details about a specific deployment specified in the
// manifest.json file.
//
// The manifest describes the type of content (its dependencies, how its
// environment can be recreated (if needed) and how it is served/executed).
type Manifest struct {
	Version     int          `json:"version"`               // Manifest version (always 1)
	Platform    string       `json:"platform"`              // Client R version
	Metadata    Metadata     `json:"metadata"`              // Properties about this deployment. Ignored by shinyapps.io
	Python      *Python      `json:"python,omitempty"`      // If non-null, specifies the Python version and dependencies
	Jupyter     *Jupyter     `json:"jupyter,omitempty"`     // If non-null, specifies the Jupyter options
	Quarto      *Quarto      `json:"quarto,omitempty"`      // If non-null, specifies the Quarto version and engines
	Environment *Environment `json:"environment,omitempty"` // Information about the execution environment
	Packages    PackageMap   `json:"packages"`              // Map of R package name to package details
	Files       FileMap      `json:"files"`                 // List of file paths contained in the bundle
}

// Metadata contains details about this deployment (type, etc).
type Metadata struct {
	AppMode         apptypes.AppMode `json:"appmode"`          // Selects the runtime for this content.
	ContentCategory string           `json:"content_category"` // A refinement of the AppMode used by plots and sites
	EntryPoint      string           `json:"entrypoint"`       // The main file being deployed.
	PrimaryRmd      string           `json:"primary_rmd"`      // Obsolete - see EntryPoint. The rendering target for Rmd deployments
	PrimaryHtml     string           `json:"primary_html"`     // Obsolete - see EntryPoint. The default document for static deployments
	HasParameters   bool             `json:"has_parameters"`   // True if this is content allows parameter customization.
}

type Environment struct {
	Image    string `json:"image"`    // The image to use during content build/execution
	Prebuilt bool   `json:"prebuilt"` // Determines whether Connect should skip the build phase for this content.
}

type Python struct {
	Version        string               `json:"version"` // The Python version
	PackageManager PythonPackageManager `json:"package_manager"`
}

type Quarto struct {
	Version string   `json:"version"`
	Engines []string `json:"engines"`
}

type Jupyter struct {
	JupyterHideAllInput    bool `json:"hide_all_input"`    // Hide code cells when rendering
	JupyterHideTaggedInput bool `json:"hide_tagged_input"` // Hide the input of cells tagged with "hide_input"
}

type PythonPackageManager struct {
	Name        string `json:"name"`         // Which package manger (always "pip")
	Version     string `json:"version"`      // Package manager version
	PackageFile string `json:"package_file"` // Filename listing dependencies; usually "requirements.txt"
}

type PackageMap map[string]Package

// Package describes a single R package.
type Package struct {
	Source      string            // Symbolic name describing where this package originated. e.g. "CRAN".
	Repository  string            // URL to the source repository
	Description map[string]string // A collection of key:value fields from the DESCRIPTION file
}

type FileMap map[string]ManifestFile

type ManifestFile struct {
	Checksum string `json:"checksum"`
}

// ReadManifest reads and parses the manifest.
func ReadManifest(r io.Reader) (*Manifest, error) {
	decoder := json.NewDecoder(r)
	manifest := NewManifest()
	err := decoder.Decode(&manifest)
	if err != nil {
		return nil, fmt.Errorf("Cannot parse manifest: %w", err)
	}
	return manifest, nil
}

// WriteManifest writes the manifest in JSON format.
func (m *Manifest) WriteManifest(w io.Writer) error {
	manifestJSON, err := m.ToJSON()
	if err != nil {
		return err
	}
	_, err = w.Write(manifestJSON)
	return err
}

// WriteManifestFile writes the manifest to a file.
func (m *Manifest) WriteManifestFile(fs afero.Fs, path string) error {
	f, err := fs.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return m.WriteManifest(f)
}

// ReadManifest reads and parses the manifest file stored at path.
func ReadManifestFile(fs afero.Fs, path string) (*Manifest, error) {
	f, err := fs.Open(path)
	if err != nil {
		return nil, fmt.Errorf("Cannot open manifest file %s: %w", path, err)
	}
	defer f.Close()
	return ReadManifest(f)
}

func NewManifest() *Manifest {
	return &Manifest{
		Version:  1,
		Packages: make(PackageMap),
		Files:    make(FileMap),
	}
}

func (manifest *Manifest) AddFile(path string, fileMD5 []byte) {
	manifest.Files[path] = ManifestFile{
		Checksum: hex.EncodeToString(fileMD5),
	}
}

func (manifest *Manifest) ToJSON() ([]byte, error) {
	return json.MarshalIndent(manifest, "", "\t")
}

func (manifest *Manifest) Clone() (*Manifest, error) {
	manifestJSON, err := manifest.ToJSON()
	if err != nil {
		return nil, err
	}
	return ReadManifest(bytes.NewReader(manifestJSON))
}
