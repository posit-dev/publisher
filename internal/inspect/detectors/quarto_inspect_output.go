package detectors

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
)

// Copyright (C) 2025 by Posit Software, PBC.

type quartoMetadata struct {
	Title   string `json:"title"`
	Runtime string `json:"runtime"`
	Server  any    `json:"server"`
}

type quartoProjectConfig struct {
	Project struct {
		Type       string   `json:"type"`
		Title      string   `json:"title"`
		PreRender  []string `json:"pre-render"`
		PostRender []string `json:"post-render"`
		OutputDir  string   `json:"output-dir"`
	} `json:"project"`
	Website struct {
		Title string `json:"title"`
	} `json:"website"`
}

type quartoFilesData struct {
	Input           []string `json:"input"`
	ConfigResources []string `json:"configResources"`
}

type quartoInspectOutput struct {
	fs afero.Fs

	// Only the fields we use are included; the rest
	// are discarded by the JSON decoder.
	Quarto struct {
		Version string `json:"version"`
	} `json:"quarto"`
	Dir     string `json:"dir"`
	Project struct {
		Dir    string              `json:"dir"`
		Config quartoProjectConfig `json:"config"`
		Files  quartoFilesData     `json:"files"`
	} `json:"project"`
	Engines []string        `json:"engines"`
	Files   quartoFilesData `json:"files"`
	// For single quarto docs without _quarto.yml
	Formats struct {
		HTML struct {
			Metadata quartoMetadata `json:"metadata"`
			Pandoc   struct {
				OutputFile string `json:"output-file"`
			} `json:"pandoc"`
		} `json:"html"`
		RevealJS struct {
			Metadata quartoMetadata `json:"metadata"`
			Pandoc   struct {
				OutputFile string `json:"output-file"`
			} `json:"pandoc"`
		} `json:"revealjs"`
	} `json:"formats"`

	// For single quarto docs without _quarto.yml,
	// there is no project section in the output.
	FileInformation map[string]struct {
		Metadata struct {
			ResourceFiles []string `json:"resource_files"`
		} `json:"metadata"`
	} `json:"fileInformation"`

	// For directory inspect (commonly due to _quarto.yml picked up as entrypoint)
	Config quartoProjectConfig `json:"config"`
}

func NewQuartoInspectOutput(output []byte) (*quartoInspectOutput, error) {
	var inspectOutput quartoInspectOutput
	err := json.Unmarshal(output, &inspectOutput)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode quarto inspect output: %w", err)
	}
	inspectOutput.fs = afero.NewOsFs()
	return &inspectOutput, nil
}

// The directory metadata field can be in two places, depending on
// whether the inspection was done on a directory (e.g: _quarto.yml is present)
// or on a single file (e.g: index.qmd as entrypoint).
func (o *quartoInspectOutput) ProjectDir() util.AbsolutePath {
	if o.Dir != "" {
		return util.NewAbsolutePath(o.Dir, o.fs)
	}
	return util.NewAbsolutePath(o.Project.Dir, o.fs)
}

// The output-dir field can be in two places or not present at all, depending on
// whether the inspection was done on a directory (e.g: _quarto.yml is present)
// or on a single file (e.g: index.qmd as entrypoint).
func (o *quartoInspectOutput) OutputDir() string {
	if o.Project.Config.Project.OutputDir != "" {
		return o.Project.Config.Project.OutputDir
	}
	return o.Config.Project.OutputDir
}

func (o *quartoInspectOutput) IsWebsite() bool {
	return o.Config.Project.Type == "website" || o.Project.Config.Project.Type == "website"
}

// Pick the input files from the possible locations in the inspect output.
// If there is not a specific list of files.input, we can fall back to
// the fileInformation map keys.
func (o *quartoInspectOutput) InputFiles() []string {
	if o.Files.Input != nil {
		return o.Files.Input
	}
	if o.Project.Files.Input != nil {
		return o.Project.Files.Input
	}
	if o.FileInformation != nil {
		filenames := []string{}
		for name := range o.FileInformation {
			filenames = append(filenames, name)
		}
		return filenames
	}
	return []string{}
}

func (o *quartoInspectOutput) toHTMLFilepath(base util.AbsolutePath, file string) util.AbsolutePath {
	var abspath util.AbsolutePath
	if filepath.IsAbs(file) {
		abspath = util.NewAbsolutePath(file, o.fs)
	} else {
		abspath = base.Join(file)
	}
	return abspath.Dir().Join(abspath.WithoutExt().Base() + ".html")
}

// Generate a list of absolute paths for the HTML version of the input files.
func (o *quartoInspectOutput) HTMLAbsPathsFromInputList(base util.AbsolutePath) []util.AbsolutePath {
	htmlFiles := []util.AbsolutePath{}
	for _, file := range o.InputFiles() {
		htmlVerFile := o.toHTMLFilepath(base, file)
		htmlFiles = append(htmlFiles, htmlVerFile)
	}
	return htmlFiles
}

// Find an index.html
func (o *quartoInspectOutput) IndexHTMLFilepath(base util.AbsolutePath) (util.AbsolutePath, bool) {
	for _, file := range o.InputFiles() {
		if strings.Contains(file, "index.") {
			return o.toHTMLFilepath(base, file), true
		}
	}
	return util.AbsolutePath{}, false
}

// Standalone rendered files by Quarto may have a *_files directory
// alongside the HTML file. E.g: Resulting assets from index.qmd, may be index.html and index_files/
func (o *quartoInspectOutput) fileAssetsDir(filepath util.AbsolutePath) (util.AbsolutePath, bool) {
	assetsDirname := filepath.WithoutExt().Base() + "_files"
	assetsPath := filepath.Dir().Join(assetsDirname)
	exists, err := assetsPath.Exists()
	// We don't really care if there is an error while looking up for an assets dir.
	// Ignore and don't return the error if the directory doesn't exist.
	if exists && err == nil {
		return assetsPath, true
	}
	return util.AbsolutePath{}, false
}

// ConfigResources can be in two places, depending on
// whether the inspection was done on a directory (e.g: _quarto.yml is present)
// or on a single file (e.g: index.qmd as entrypoint).
func (o *quartoInspectOutput) ConfigResources() []string {
	if o.Project.Files.ConfigResources != nil {
		return o.Project.Files.ConfigResources
	}
	if o.Files.ConfigResources != nil {
		return o.Files.ConfigResources
	}
	return []string{}
}

// File resources can be duplicated across files, and we want to avoid
// including the same file multiple times in the configuration.
func (o *quartoInspectOutput) uniqueFileResources(target []string, resourceFiles []string) []string {
	resourcesFound := []string{}
	for _, fileResource := range resourceFiles {
		// Prevent duplicated files
		if slices.Contains(target, fileResource) {
			continue
		}

		// Prevent special YML files here (those are handled later)
		if slices.Contains(specialYmlFiles, fileResource) {
			continue
		}

		resourcesFound = append(resourcesFound, fileResource)
	}
	return resourcesFound
}

// File resources are important for a successful render, so we include them.
func (o *quartoInspectOutput) FileInfoResources() []string {
	if o.FileInformation == nil {
		return []string{}
	}

	filesResources := []string{}
	for _, fileInfo := range o.FileInformation {
		if fileInfo.Metadata.ResourceFiles != nil {
			filesResources = append(
				filesResources,
				o.uniqueFileResources(filesResources, fileInfo.Metadata.ResourceFiles)...)
		}
	}

	return filesResources
}

// Pre and post render scripts are important for a successful render, so we include them.
// Pre and post render scripts can be in two places, depending on
// whether the inspection was done on a directory (e.g: _quarto.yml is present)
// or on a single file (e.g: index.qmd as entrypoint).
func (o *quartoInspectOutput) PrePostRenderFiles() []string {
	filenames := []string{}
	preRender := o.Config.Project.PreRender
	preRenderAlt := o.Project.Config.Project.PreRender
	postRender := o.Config.Project.PostRender
	postRenderAlt := o.Project.Config.Project.PostRender
	if preRender != nil {
		filenames = append(filenames, preRender...)
	}
	if preRenderAlt != nil {
		filenames = append(filenames, preRenderAlt...)
	}
	if postRender != nil {
		filenames = append(filenames, postRender...)
	}
	if postRenderAlt != nil {
		filenames = append(filenames, postRenderAlt...)
	}
	return filenames
}

// Include the entrypoint, its associated files and pre-post render scripts
func (o *quartoInspectOutput) ProjectRequiredFiles() []string {
	files := o.InputFiles()
	files = append(files, o.ConfigResources()...)
	files = append(files, o.FileInfoResources()...)
	files = append(files, o.PrePostRenderFiles()...)
	return files
}
