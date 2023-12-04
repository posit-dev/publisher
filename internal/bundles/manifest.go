package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sort"

	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
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
	Version     int             `json:"version"`                             // Manifest version (always 1)
	Locale      string          `json:"locale,omitempty"`                    // User's locale. Currently unused.
	Platform    string          `json:"platform,omitempty" name:"r-version"` // Client R version
	Metadata    Metadata        `json:"metadata"`                            // Properties about this deployment. Ignored by shinyapps.io
	Python      *Python         `json:"python,omitempty"`                    // If non-null, specifies the Python version and dependencies
	Jupyter     *Jupyter        `json:"jupyter,omitempty"`                   // If non-null, specifies the Jupyter options
	Quarto      *Quarto         `json:"quarto,omitempty"`                    // If non-null, specifies the Quarto version and engines
	Environment *Environment    `json:"environment,omitempty"`               // Information about the execution environment
	Packages    PackageMap      `json:"packages"`                            // Map of R package name to package details
	Files       ManifestFileMap `json:"files"`                               // List of file paths contained in the bundle
}

// Metadata contains details about this deployment (type, etc).
type Metadata struct {
	AppMode         connect.AppMode `json:"appmode" help:"Type of content being deployed. Default is to auto detect."` // Selects the runtime for this content.
	ContentCategory string          `json:"content_category,omitempty"`                                                // A refinement of the AppMode used by plots and sites
	Entrypoint      string          `json:"entrypoint,omitempty"`                                                      // The main file being deployed.
	PrimaryRmd      string          `json:"primary_rmd,omitempty"`                                                     // The rendering target for Rmd deployments.
	PrimaryHtml     string          `json:"primary_html,omitempty"`                                                    // The default document for static deployments.
	HasParameters   bool            `json:"has_parameters,omitempty"`                                                  // True if this is content allows parameter customization.
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
	HideAllInput    bool `json:"hide_all_input"`    // Hide code cells when rendering
	HideTaggedInput bool `json:"hide_tagged_input"` // Hide the input of cells tagged with "hide_input"
}

type PythonPackageManager struct {
	Name        string `json:"name"`
	Version     string `json:"version,omitempty"` // Package manager version
	PackageFile string `json:"package_file"`      // Filename listing dependencies; usually "requirements.txt"
}

type PackageMap map[string]Package
type DescriptionMap map[string]string

// Package describes a single R package.
type Package struct {
	Source      string         // Symbolic name describing where this package originated. e.g. "CRAN".
	Repository  string         // URL to the source repository
	Description DescriptionMap // A collection of key:value fields from the DESCRIPTION file
}

type ManifestFileMap map[string]ManifestFile

func NewManifestFileMap() ManifestFileMap {
	return ManifestFileMap{}
}

type ManifestFile struct {
	Checksum string `json:"checksum"`
}

func NewManifestFile() ManifestFile {
	return ManifestFile{}
}

// ReadManifest reads and parses the manifest.
func ReadManifest(r io.Reader) (*Manifest, error) {
	decoder := json.NewDecoder(r)
	manifest := NewManifest()
	err := decoder.Decode(&manifest)
	if err != nil {
		return nil, fmt.Errorf("cannot parse manifest: %w", err)
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
func (m *Manifest) WriteManifestFile(path util.Path) error {
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	return m.WriteManifest(f)
}

// ReadManifest reads and parses the manifest file stored at path.
func ReadManifestFile(path util.Path) (*Manifest, error) {
	f, err := path.Open()
	if err != nil {
		return nil, fmt.Errorf("cannot open manifest file %s: %w", path, err)
	}
	defer f.Close()
	return ReadManifest(f)
}

func NewManifest() *Manifest {
	return &Manifest{
		Version:     1,
		Python:      &Python{},
		Quarto:      &Quarto{},
		Jupyter:     &Jupyter{},
		Environment: &Environment{},
		Packages:    make(PackageMap),
		Files:       make(ManifestFileMap),
	}
}

var connectContentTypeMap = map[config.ContentType]connect.AppMode{
	config.ContentTypeHTML:            connect.StaticMode,
	config.ContentTypeJupyterNotebook: connect.StaticJupyterMode,
	config.ContentTypeJupyterVoila:    connect.JupyterVoilaMode,
	config.ContentTypePythonBokeh:     connect.PythonBokehMode,
	config.ContentTypePythonDash:      connect.PythonDashMode,
	config.ContentTypePythonFastAPI:   connect.PythonFastAPIMode,
	config.ContentTypePythonFlask:     connect.PythonAPIMode,
	config.ContentTypePythonShiny:     connect.PythonShinyMode,
	config.ContentTypePythonStreamlit: connect.PythonStreamlitMode,
	config.ContentTypeQuartoShiny:     connect.ShinyQuartoMode,
	config.ContentTypeQuarto:          connect.StaticQuartoMode,
	config.ContentTypeRPlumber:        connect.PlumberAPIMode,
	config.ContentTypeRShiny:          connect.ShinyMode,
	config.ContentTypeRMarkdownShiny:  connect.ShinyRmdMode,
	config.ContentTypeRMarkdown:       connect.StaticRmdMode,
}

func NewManifestFromConfig(cfg *config.Config) *Manifest {
	contentType, ok := connectContentTypeMap[cfg.Type]
	if !ok {
		contentType = connect.UnknownMode
	}
	m := &Manifest{
		Version: 1,
		Metadata: Metadata{
			AppMode:    contentType,
			Entrypoint: cfg.Entrypoint,
		},
		Jupyter:     nil,
		Environment: nil,
		Packages:    make(PackageMap),
		Files:       make(ManifestFileMap),
	}
	if cfg.R != nil {
		m.Platform = cfg.R.Version
	}
	if cfg.Python != nil {
		m.Python = &Python{
			Version: cfg.Python.Version,
			PackageManager: PythonPackageManager{
				Name:        cfg.Python.PackageManager,
				PackageFile: cfg.Python.PackageFile,
			},
		}
	}
	if cfg.Quarto != nil {
		m.Quarto = &Quarto{
			Version: cfg.Quarto.Version,
			Engines: cfg.Quarto.Engines,
		}
	}
	switch cfg.Type {
	case config.ContentTypeRMarkdown:
	case config.ContentTypeRMarkdownShiny:
		m.Metadata.PrimaryRmd = cfg.Entrypoint
	case config.ContentTypeHTML:
		m.Metadata.PrimaryHtml = cfg.Entrypoint
	}
	return m
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

func (manifest *Manifest) GetFilenames() []string {
	names := []string{}
	for name := range manifest.Files {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
