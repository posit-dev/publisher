package detectors

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ResourceFinderSuite struct {
	utiltest.Suite
}

func TestResourceFinderSuite(t *testing.T) {
	suite.Run(t, new(ResourceFinderSuite))
}

// Method to assert that expected resource paths are found in the list of detected resources
// without considering order since order is subject to change easily.
func (s *ResourceFinderSuite) assertResources(expectedPaths []string, inResources []ExternalResource) {
	s.Equal(len(expectedPaths), len(inResources), "Expected number of resources to match")
	for _, expected := range expectedPaths {
		found := false
		for _, resource := range inResources {
			if resource.Path == expected {
				found = true
				break
			}
		}
		s.True(found, "Expected to find resource path %q in resources: %+v", expected, inResources)
	}
}

func (s *ResourceFinderSuite) TestDetect_MarkdownSyntaxTest() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	rmdTestTarget := base.Join("index.rmd")

	resourceFinder, err := NewResourceFinder(logging.New(), base, rmdTestTarget)
	s.Nil(err)

	resources, err := resourceFinder.FindResources()
	s.Nil(err)
	s.assertResources([]string{
		"styles/custom.css",
		"styles/Lato-Regular.ttf",
		"styles/themes/default.css",
		"data/dataset.rds",
		"posit-logo.svg",
		"pizza-icon.png",
	}, resources)
}

func (s *ResourceFinderSuite) TestDetect_HTMLTest() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	rmdTestTarget := base.Join("index.html")

	resourceFinder, err := NewResourceFinder(logging.New(), base, rmdTestTarget)
	s.Nil(err)

	resources, err := resourceFinder.FindResources()
	s.Nil(err)
	s.assertResources([]string{
		"styles/custom.css",
		"styles/Lato-Regular.ttf",
		"styles/themes/default.css",
		"assets/bundle.js",
		"images/logo.svg",
		"assets/blank_video.mp4",
		"assets/no_audio.mp3",
		"pizza-icon.png",
	}, resources)
}

func (s *ResourceFinderSuite) TestDetect_ProjectRootReferencePathsTest() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	rmdTestTarget := base.Join("subdir", "second-page.rmd")

	resourceFinder, err := NewResourceFinder(logging.New(), base, rmdTestTarget)
	s.Nil(err)

	resources, err := resourceFinder.FindResources()
	s.Nil(err)
	s.assertResources([]string{
		"styles/custom.css",
		"styles/Lato-Regular.ttf",
		"styles/themes/default.css",
		"posit-logo.svg",
		"subdir/pizza-copy.png",
		"pizza-icon.png",
	}, resources)
}

func (s *ResourceFinderSuite) TestFindAndIncludeAssets_AddsNewResources() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	log := logging.New()

	// Create a factory function that returns a real MultiResourceFinder
	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	// Create a config with an initial file that references resources
	cfg := config.New()
	cfg.Type = "test-project"
	cfg.Files = []string{"/index.rmd"}

	// Call the function
	findAndIncludeAssets(log, rfFactory, base, cfg)

	// Verify that resources were added
	expectedResources := []string{
		"/index.rmd",
		"/styles/custom.css",
		"/styles/Lato-Regular.ttf",
		"/styles/themes/default.css",
		"/data/dataset.rds",
		"/posit-logo.svg",
		"/pizza-icon.png",
	}

	s.Equal(len(expectedResources), len(cfg.Files), "Expected number of files to match")
	for _, expected := range expectedResources {
		s.Contains(cfg.Files, expected, "Expected to find %s in cfg.Files", expected)
	}
}

func (s *ResourceFinderSuite) TestFindAndIncludeAssets_SkipsDuplicates() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	log := logging.New()

	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	// Create a config with files that already includes some resources
	cfg := config.New()
	cfg.Type = "test-project"
	cfg.Files = []string{"/index.rmd", "/pizza-icon.png"}

	initialFileCount := len(cfg.Files)

	// Call the function
	findAndIncludeAssets(log, rfFactory, base, cfg)

	// Verify that pizza-icon.png wasn't added again
	count := 0
	for _, file := range cfg.Files {
		if file == "/pizza-icon.png" {
			count++
		}
	}
	s.Equal(1, count, "Expected pizza-icon.png to appear only once")

	// But other resources should have been added
	s.Greater(len(cfg.Files), initialFileCount, "Expected new resources to be added")
}

func (s *ResourceFinderSuite) TestFindAndIncludeAssets_SkipsNestedResources() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	log := logging.New()

	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	// Create a config that already includes the entire styles directory
	cfg := config.New()
	cfg.Type = "test-project"
	cfg.Files = []string{"/index.rmd", "/styles"}

	// Call the function
	findAndIncludeAssets(log, rfFactory, base, cfg)

	// Verify that nested files in /styles directory were not added individually
	for _, file := range cfg.Files {
		if file != "/styles" && file != "/index.rmd" {
			s.NotContains(file, "styles/", "Expected nested styles files to not be added when /styles is already included")
		}
	}
}

func (s *ResourceFinderSuite) TestFindAndIncludeAssets_HandlesMultipleInputFiles() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "resource-finder")
	log := logging.New()

	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	// Create a config with multiple input files
	cfg := config.New()
	cfg.Type = "test-project"
	cfg.Files = []string{"/index.rmd", "/index.html"}

	// Call the function
	findAndIncludeAssets(log, rfFactory, base, cfg)

	// Verify that resources from both files were discovered
	// index.html references assets/bundle.js which index.rmd doesn't
	s.Contains(cfg.Files, "/assets/bundle.js", "Expected to find resource from index.html")
	// Both files reference pizza-icon.png
	s.Contains(cfg.Files, "/pizza-icon.png", "Expected to find shared resource")
	// index.rmd references data/dataset.rds which index.html doesn't
	s.Contains(cfg.Files, "/data/dataset.rds", "Expected to find resource from index.rmd")
}

func (s *ResourceFinderSuite) TestProcessHTMLLinkMatches() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-with-html")
	inputFile := base.Join("index.qmd")

	// Create a resource finder instance
	rf, err := NewResourceFinder(logging.New(), base, inputFile)
	s.NoError(err)

	// Should match the markdown link syntax [text](path)
	// Format: [][]string where each inner slice is [fullMatch, capturedPath]
	matches := [][]string{
		{"[flowers](flowers.html)", "flowers.html"},                // Should be included
		{"[link](https://cuberule.com/)", "https://cuberule.com/"}, // Should NOT be included (full URL)
		{"[script](assets/script.js)", "assets/script.js"},         // Should NOT be included (not HTML)
	}

	rf.processHTMLLinkMatches(matches)
	s.Contains(rf.Resources, "flowers.html", "Expected flowers.html to be included")

	// flowers.html gets recursively processed, so its assets should be included
	s.Contains(rf.Resources, "assets/script.js", "Expected assets/script.js from flowers.html to be included")
	s.Contains(rf.Resources, "assets/styles.css", "Expected assets/styles.css from flowers.html to be included")
	s.Contains(rf.Resources, "images/dandelion.jpg", "Expected images/dandelion.jpg from flowers.html to be included")
	s.Contains(rf.Resources, "images/lilac.jpg", "Expected images/lilac.jpg from flowers.html to be included")

	// Should NOT include full URLs
	for path := range rf.Resources {
		s.NotContains(path, "https://", "Expected full URLs to NOT be included")
		s.NotContains(path, "cuberule.com", "Expected full URLs to NOT be included")
	}
}

func (s *ResourceFinderSuite) TestDiscoverMarkdownResources_HTMLLinks() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-with-html")
	inputFile := base.Join("index.qmd")

	rf, err := NewResourceFinder(logging.New(), base, inputFile)
	s.NoError(err)

	err = rf.discoverMarkdownResources(inputFile)
	s.NoError(err)

	// Verify that flowers.html was discovered from the markdown link
	s.Contains(rf.Resources, "flowers.html", "Expected to discover flowers.html from markdown link")
}

func (s *ResourceFinderSuite) TestRecursiveHTMLDiscovery() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-with-html")
	inputFile := base.Join("index.qmd")

	rf, err := NewResourceFinder(logging.New(), base, inputFile)
	s.NoError(err)

	resources, err := rf.FindResources()
	s.NoError(err)

	// Verify that resources from both index.qmd and flowers.html were discovered
	s.assertResources([]string{
		"flowers.html",
		"assets/styles.css",
		"assets/script.js",
		"images/dandelion.jpg",
		"images/lilac.jpg",
	}, resources)
}

func (s *ResourceFinderSuite) TestQuartoWebsiteWithHTML_Integration() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-with-html")
	log := logging.New()

	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	// Simulate a config with index.qmd that already has flowers.html in resource_files
	cfg := config.New()
	cfg.Type = "quarto-website"
	cfg.Files = []string{"/index.qmd", "/flowers.html"}

	findAndIncludeAssets(log, rfFactory, base, cfg)

	// Verify that all assets were discovered:
	// - From index.qmd: flowers.html link
	// - From flowers.html: images, CSS, JS
	expectedFiles := []string{
		"/index.qmd",
		"/flowers.html",
		"/assets/styles.css",
		"/assets/script.js",
		"/images/dandelion.jpg",
		"/images/lilac.jpg",
	}

	for _, expected := range expectedFiles {
		s.Contains(cfg.Files, expected, "Expected to find %s in cfg.Files", expected)
	}

	// Verify external URLs are not included
	for _, file := range cfg.Files {
		s.NotContains(file, "https://", "Expected no external URLs in cfg.Files")
		s.NotContains(file, "cuberule.com", "Expected no external URLs in cfg.Files")
		s.NotContains(file, "wikipedia.org", "Expected no external URLs in cfg.Files")
	}
}
