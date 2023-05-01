package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"reflect"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/spf13/afero"
)

// ManifestFilename is the well-known manifest.json filename contained within
// deployment bundles.
const ManifestFilename = "manifest.json"

// PythonRequirementsFilename is the well-known filename for the
// Python pip package dependency list.
const PythonRequirementsFilename = "requirements.txt"

// Manifest contains details about a specific deployment specified in the
// manifest.json file.
//
// The manifest describes the type of content (its dependencies, how its
// environment can be recreated (if needed) and how it is served/executed).
type Manifest struct {
	Version     int          `json:"version" kong:"-"`                           // Manifest version (always 1)
	Platform    string       `json:"platform,omitempty" kong:"-"`                // Client R version
	Metadata    Metadata     `json:"metadata" embed:""`                          // Properties about this deployment. Ignored by shinyapps.io
	Python      *Python      `json:"python,omitempty" embed:"" prefix:"python-"` // If non-null, specifies the Python version and dependencies
	Jupyter     *Jupyter     `json:"jupyter,omitempty" embed:""`                 // If non-null, specifies the Jupyter options
	Quarto      *Quarto      `json:"quarto,omitempty" embed:"" prefix:"quarto-"` // If non-null, specifies the Quarto version and engines
	Environment *Environment `json:"environment,omitempty" embed:""`             // Information about the execution environment
	Packages    PackageMap   `json:"packages" kong:"-"`                          // Map of R package name to package details
	Files       FileMap      `json:"files" kong:"-"`                             // List of file paths contained in the bundle
}

// Metadata contains details about this deployment (type, etc).
type Metadata struct {
	AppMode         apptypes.AppMode `json:"appmode" short:"t" help:"Type of content being deployed. Default is to auto detect."` // Selects the runtime for this content.
	ContentCategory string           `json:"content_category,omitempty"`                                                          // A refinement of the AppMode used by plots and sites
	Entrypoint      string           `json:"entrypoint"`                                                                          // The main file being deployed.
	PrimaryRmd      string           `json:"primary_rmd,omitempty" kong:"-"`                                                      // The rendering target for Rmd deployments.
	PrimaryHtml     string           `json:"primary_html,omitempty" kong:"-"`                                                     // The default document for static deployments.
	HasParameters   bool             `json:"has_parameters,omitempty" kong:"-"`                                                   // True if this is content allows parameter customization.
}

type Environment struct {
	Image    string `json:"image"`                 // The image to use during content build/execution
	Prebuilt bool   `json:"prebuilt" negatable:""` // Determines whether Connect should skip the build phase for this content.
}

type Python struct {
	Version        string               `json:"version"` // The Python version
	PackageManager PythonPackageManager `json:"package_manager" embed:""`
}

type Quarto struct {
	Version string   `json:"version"`
	Engines []string `json:"engines"`
}

type Jupyter struct {
	HideAllInput    bool `json:"hide_all_input" negatable:""`    // Hide code cells when rendering
	HideTaggedInput bool `json:"hide_tagged_input" negatable:""` // Hide the input of cells tagged with "hide_input"
}

type PythonPackageManager struct {
	Name        string `json:"name" kong:"-"`              // Which package manger (always "pip")
	Version     string `json:"version,omitempty" kong:"-"` // Package manager version
	PackageFile string `json:"package_file"`               // Filename listing dependencies; usually "requirements.txt"
	Packages    []byte `json:"-" kong:"-"`                 // Not part of the manifest. Temporary holding place for Python package dependencies.
}

type PackageMap map[string]Package
type DescriptionMap map[string]string

// Package describes a single R package.
type Package struct {
	Source      string         // Symbolic name describing where this package originated. e.g. "CRAN".
	Repository  string         // URL to the source repository
	Description DescriptionMap // A collection of key:value fields from the DESCRIPTION file
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

// ResetEmptyFields resets any of the optional sub-structs to nil
// if they have their zero values. We do this because Kong
// creates all sub-structs during CLI parsing, but we would
// prefer to omit them from the JSON if they are empty.
func (manifest *Manifest) ResetEmptyFields() {
	if reflect.DeepEqual(manifest.Python, &Python{}) {
		manifest.Python = nil
	}
	if reflect.DeepEqual(manifest.Jupyter, &Jupyter{}) {
		manifest.Jupyter = nil
	}
	if reflect.DeepEqual(manifest.Quarto, &Quarto{}) {
		manifest.Quarto = nil
	}
	if reflect.DeepEqual(manifest.Environment, &Environment{}) {
		manifest.Environment = nil
	}
}
