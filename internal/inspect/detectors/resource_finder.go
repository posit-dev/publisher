package detectors

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bufio"
	"fmt"
	"io"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type ResourceFinder interface {
	FindResources() ([]ExternalResource, error)
}

type multiResourceFinderFactory func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error)

type ExternalResource struct {
	Path string // Relative path to the resource
}

type resourceFinder struct {
	log          logging.Logger
	base         util.AbsolutePath
	InputDir     util.AbsolutePath
	InputFile    util.AbsolutePath
	InputFileExt string
	Resources    map[string]ExternalResource
}

type multiResourceFinder struct {
	finders []ResourceFinder
}

func NewMultiResourceFinder(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (*multiResourceFinder, error) {
	// config.Files are relative to base, although they have absolute path notation in Config object (e.g: "/logo.png")
	var finders []ResourceFinder
	for _, file := range filesFromConfig {
		absPath := base.Join(file)
		rf, err := NewResourceFinder(log, base, absPath)
		if err != nil {
			// Files incompatible with resource finder, we just skip them
			log.Debug("Cannot build resource finder for file", "file", file, "error", err.Error())
			continue
		}
		finders = append(finders, rf)
	}
	return &multiResourceFinder{finders: finders}, nil
}

func (rf *multiResourceFinder) FindResources() ([]ExternalResource, error) {
	resourceMap := make(map[string]ExternalResource)
	for _, finder := range rf.finders {
		resources, err := finder.FindResources()
		if err != nil {
			return nil, err
		}
		for _, res := range resources {
			resourceMap[res.Path] = res
		}
	}

	var resources []ExternalResource
	for _, resource := range resourceMap {
		resources = append(resources, resource)
	}

	return resources, nil
}

func NewResourceFinder(log logging.Logger, base util.AbsolutePath, inputFile util.AbsolutePath) (*resourceFinder, error) {
	// Validate file type
	ext := strings.ToLower(inputFile.Ext())
	supportedExtensions := map[string]bool{
		".md":   true,
		".rmd":  true,
		".qmd":  true,
		".html": true,
		".htm":  true,
		".r":    true,
		".css":  true,
	}

	if !supportedExtensions[ext] {
		return nil, fmt.Errorf("resource discovery is only supported for R Markdown, Quarto files or HTML (and CSS) files")
	}

	return &resourceFinder{
		log:          log,
		base:         base,
		InputDir:     inputFile.Dir(),
		InputFile:    inputFile,
		InputFileExt: ext,
		Resources:    make(map[string]ExternalResource),
	}, nil
}

func (rf *resourceFinder) FindResources() ([]ExternalResource, error) {
	// Create an empty slice to collect resources
	var resources []ExternalResource

	rf.log.Debug("Starting resource discovery", "file", rf.InputFile.String())

	// Discover resources based on file type
	var err error
	switch rf.InputFileExt {
	case ".md", ".rmd", ".qmd":
		err = rf.discoverMarkdownResources(rf.InputFile)
	case ".html", ".htm":
		err = rf.discoverHTMLResources(rf.InputFile)
	case ".r":
		err = rf.discoverRResources(rf.InputFile)
	case ".css":
		err = rf.discoverCSSResources(rf.InputFile)
	}

	if err != nil {
		return nil, err
	}

	// Convert map to slice for return
	for _, resource := range rf.Resources {
		resources = append(resources, resource)
	}

	return resources, nil
}

// Add a resource to the finder if it exists on disk
func (rf *resourceFinder) addResource(relpath string, explicit bool) bool {
	var abspath util.AbsolutePath
	rf.log.Debug("Found resource, validating...", "resource", relpath)

	// Resources that start with / are relative to the project's base directory
	hasLeadingSlash := strings.HasPrefix(relpath, "/")
	if hasLeadingSlash {
		abspath = rf.base.Join(relpath)
	} else {
		abspath = rf.InputDir.Join(relpath)
	}

	// Check if path exists on disk
	if _, err := abspath.Stat(); os.IsNotExist(err) {
		rf.log.Debug("Resource does not exist on disk, ignoring", "resource", relpath)
		return false
	}

	// We only add directories if this is an explicit reference
	// (e.g. from resource_files: in YAML front matter)
	// Implicit references (e.g. from Markdown image links) must be files
	// so we skip directories in that case
	if !explicit {
		fi, err := abspath.Stat()
		if err != nil {
			return false
		}
		if fi.IsDir() {
			return false
		}
	}

	relToBase, err := abspath.Rel(rf.base)
	if err != nil {
		// Ignoring error here, issues making a relative path should not stop discovery
		return false
	}

	// If not already tracked, or if this is an explicit reference to something
	// that was previously discovered implicitly, add/update it
	relPathString := relToBase.String()
	if _, exists := rf.Resources[relPathString]; !exists {
		rf.log.Debug("Including resource", "resource", relPathString)
		rf.Resources[relPathString] = ExternalResource{
			// Be consistent with list items, always return relative paths without leading slash
			Path: strings.TrimPrefix(relPathString, "/"),
		}
	}

	// If this is an R, CSS, or HTML file, process it recursively
	ext := strings.ToLower(abspath.Ext())
	if ext == ".r" || ext == ".css" || ext == ".html" || ext == ".htm" {
		switch ext {
		case ".r":
			rf.discoverRResources(abspath)
		case ".css":
			rf.discoverCSSResources(abspath)
		case ".html", ".htm":
			rf.discoverHTMLResources(abspath)
		}
	}

	return true
}

func (rf *resourceFinder) processResourceMatches(matches [][]string, branchedFrom *util.AbsolutePath) {
	for _, match := range matches {
		if len(match) > 1 {
			path := match[1]
			if rf.isFullURL(path) {
				// Skip web URLs, we only want to add local resources
				continue
			}
			if branchedFrom != nil {
				// When a resource was found in a file that was found to be a resource itself,
				// we need to resolve the path relative to the inspection input dir
				fullPath := branchedFrom.Dir().Join(path)
				relPath, err := fullPath.Rel(rf.InputDir)
				if err != nil {
					// Ignoring error here, issues making a relative path should not stop discovery
					continue
				}
				path = relPath.String()
			}
			rf.addResource(path, false)
		}
	}
}

func (rf *resourceFinder) processResourceByteMatches(matches [][][]byte, branchedFrom *util.AbsolutePath) {
	stringMatches := make([][]string, len(matches))
	for i, match := range matches {
		stringMatch := make([]string, len(match))
		for j, m := range match {
			stringMatch[j] = string(m)
		}
		stringMatches[i] = stringMatch
	}
	rf.processResourceMatches(stringMatches, branchedFrom)
}

// Process markdown link matches and add only HTML files as resources
func (rf *resourceFinder) processHTMLLinkMatches(matches [][]string) {
	for _, match := range matches {
		if len(match) > 1 {
			path := match[1]
			if rf.isFullURL(path) {
				// Skip web URLs, we only want to add local resources
				continue
			}
			// Only include HTML files
			if strings.HasSuffix(strings.ToLower(path), ".html") || strings.HasSuffix(strings.ToLower(path), ".htm") {
				rf.addResource(path, false)
			}
		}
	}
}

// Discover resources in Markdown, R Markdown, and Quarto files
func (rf *resourceFinder) discoverMarkdownResources(fpath util.AbsolutePath) error {
	file, err := fpath.Open()
	if err != nil {
		rf.log.Debug("Could not open file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}
	defer file.Close()

	// Create a scanner to read the file line by line
	scanner := bufio.NewScanner(file)

	// Regular expression for Markdown image syntax: ![alt](path)
	imgRegex := regexp.MustCompile(`!\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)`)

	// Regular expression for Markdown link syntax: [text](path)
	// This will also match images, but we filter for .html/.htm in processing
	linkRegex := regexp.MustCompile(`\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)`)

	// Regular expression for inline HTML image tags: <img src="path" ...>
	htmlImgRegex := regexp.MustCompile(`<img\s+[^>]*src=["'](.*?)["'][^>]*>`)

	// Scan for YAML front matter and explicit resource declarations
	inYAML := false
	var yamlContent strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		// Check for YAML front matter delimiters
		if line == "---" {
			if !inYAML {
				inYAML = true
				continue
			} else {
				inYAML = false
				// Parse YAML content for resources
				rf.parseYAMLResourceFiles(yamlContent.String())
				yamlContent.Reset()
				continue
			}
		}

		if inYAML {
			yamlContent.WriteString(line)
			yamlContent.WriteString("\n")
			continue
		}

		// Find Markdown image references
		matches := imgRegex.FindAllStringSubmatch(line, -1)
		rf.processResourceMatches(matches, nil)

		// Find Markdown links to HTML files
		linkMatches := linkRegex.FindAllStringSubmatch(line, -1)
		rf.processHTMLLinkMatches(linkMatches)

		// Find HTML image tags
		htmlMatches := htmlImgRegex.FindAllStringSubmatch(line, -1)
		rf.processResourceMatches(htmlMatches, nil)
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}

// Discover resources in R files
func (rf *resourceFinder) discoverRResources(fpath util.AbsolutePath) error {
	file, err := fpath.Open()
	if err != nil {
		rf.log.Debug("Could not open file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		rf.log.Debug("Could not read file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}

	// Remove comments, so we don't pick up possible paths in comments
	contentStr := string(content)
	lines := strings.Split(contentStr, "\n")
	for i, line := range lines {
		if idx := strings.Index(line, "#"); idx >= 0 {
			lines[i] = line[:idx]
		}
	}
	contentStr = strings.Join(lines, "\n")

	// Extract double-quoted strings
	doubleQuoteRegex := regexp.MustCompile(`"([^"\n]*)"`)
	matches := doubleQuoteRegex.FindAllStringSubmatch(contentStr, -1)
	rf.processResourceMatches(matches, &fpath)

	// Extract single-quoted strings
	singleQuoteRegex := regexp.MustCompile(`'([^'\n]*)'`)
	matches = singleQuoteRegex.FindAllStringSubmatch(contentStr, -1)
	rf.processResourceMatches(matches, &fpath)

	return nil
}

// Discover resources in HTML files
func (rf *resourceFinder) discoverHTMLResources(fpath util.AbsolutePath) error {
	file, err := fpath.Open()
	if err != nil {
		rf.log.Debug("Could not open file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		rf.log.Debug("Could not read file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}

	// Regular expressions to find common resource references in HTML
	patterns := map[string]*regexp.Regexp{
		"img":    regexp.MustCompile(`<img\s+[^>]*src=["'](.*?)["'][^>]*>`),
		"link":   regexp.MustCompile(`<link\s+[^>]*href=["'](.*?)["'][^>]*>`),
		"script": regexp.MustCompile(`<script\s+[^>]*src=["'](.*?)["'][^>]*>`),
		"video":  regexp.MustCompile(`<video\s+[^>]*src=["'](.*?)["'][^>]*>`),
		"audio":  regexp.MustCompile(`<audio\s+[^>]*src=["'](.*?)["'][^>]*>`),
		"source": regexp.MustCompile(`<source\s+[^>]*src=["'](.*?)["'][^>]*>`),
	}

	// Apply each pattern to the content
	for _, pattern := range patterns {
		matches := pattern.FindAllSubmatch(content, -1)
		rf.processResourceByteMatches(matches, &fpath)
	}

	return nil
}

// Discover resources in CSS files
func (rf *resourceFinder) discoverCSSResources(fpath util.AbsolutePath) error {
	file, err := fpath.Open()
	if err != nil {
		rf.log.Debug("Could not open file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		rf.log.Debug("Could not read file for resource discovery", "file", fpath.String(), "error", err.Error())
		return err
	}

	// Find URL references in CSS
	urlRegex := regexp.MustCompile(`url\(['"]?([^'")]+)['"]?\)`)
	matches := urlRegex.FindAllSubmatch(content, -1)
	rf.processResourceByteMatches(matches, &fpath)

	return nil
}

// Parses YAML front matter for resource_files entries
func (rf *resourceFinder) parseYAMLResourceFiles(yamlContent string) {
	rf.log.Debug("Parsing YAML front matter looking up for resources")

	// Look for resource_files: entries in YAML
	lines := strings.Split(yamlContent, "\n")
	inResourceFiles := false

	for _, line := range lines {
		// Trim whitespace
		trimmedLine := strings.TrimSpace(line)

		// Check for resource_files: section
		if strings.HasPrefix(trimmedLine, "resource_files:") {
			rf.log.Debug("Found resource_files spec in YAML front matter")
			inResourceFiles = true
			continue
		}

		// If we're in the resource_files section and the line starts with a dash,
		// it's likely a list item declaring a resource
		if inResourceFiles && strings.HasPrefix(trimmedLine, "-") {
			// Extract the path from the line (removing the dash and trimming)
			path := strings.TrimSpace(strings.TrimPrefix(trimmedLine, "-"))

			// If it's wrapped in quotes, remove them
			if (strings.HasPrefix(path, "'") && strings.HasSuffix(path, "'")) ||
				(strings.HasPrefix(path, "\"") && strings.HasSuffix(path, "\"")) {
				path = path[1 : len(path)-1]
			}

			if path != "" && !rf.isFullURL(path) {
				// Handle wildcards and directories
				if strings.Contains(path, "*") {
					// For wildcards, use filepath.Glob to find matching files
					matches, err := rf.InputDir.Glob(path)
					if err == nil {
						for _, match := range matches {
							relpath, _ := match.Rel(rf.InputDir)
							rf.addResource(relpath.String(), true)
						}
					}
				} else {
					// Check if it's a directory
					fullPath := rf.InputDir.Join(path)
					fi, err := fullPath.Stat()
					if err == nil && fi.IsDir() {
						// For directories, walk the directory and add all files
						fullPath.Walk(func(filePath util.AbsolutePath, info os.FileInfo, err error) error {
							if err == nil && !info.IsDir() {
								relpath, _ := filePath.Rel(rf.InputDir)
								rf.addResource(relpath.String(), true)
							}
							return nil
						})
					} else {
						// Otherwise add as a regular resource
						rf.addResource(path, true)
					}
				}
			}
		} else if inResourceFiles && !strings.HasPrefix(trimmedLine, " ") && trimmedLine != "" {
			// If we encounter a line that doesn't start with space and isn't empty,
			// we've left the resource_files section
			inResourceFiles = false
		}
	}
}

func (rf *resourceFinder) isFullURL(path string) bool {
	u, err := url.ParseRequestURI(path)
	return err == nil && u.Scheme != "" && u.Host != ""
}

// Use resource finder to identify additional resources for the configuration.
// Additional static assets can be scattered alongside files.
func findAndIncludeAssets(
	log logging.Logger,
	rfFactory multiResourceFinderFactory,
	base util.AbsolutePath,
	cfg *config.Config,
) {
	rFinder, err := rfFactory(log, base, cfg.Files)
	if err != nil {
		log.Error(fmt.Sprintf("Error creating resource finder for %s project", cfg.Type), "error", err)
		return
	}
	resources, err := rFinder.FindResources()
	if err != nil {
		log.Error(fmt.Sprintf("Error finding resources for %s project", cfg.Type), "error", err)
		return
	}
	for _, rsrc := range resources {
		// Do not include assets that are nested in an already included directory.
		// e.g. if /index_files is included, do not include /index_files/custom.css
		rsrcRoot := strings.Split(rsrc.Path, "/")[0]
		rsrcStringToAdd := fmt.Sprint("/", rsrc.Path)
		rsrcDirIncluded := slices.Contains(cfg.Files, fmt.Sprint("/", rsrcRoot))
		if !rsrcDirIncluded && !slices.Contains(cfg.Files, rsrcStringToAdd) {
			cfg.Files = append(cfg.Files, rsrcStringToAdd)
		}
	}
}
