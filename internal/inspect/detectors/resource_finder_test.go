package detectors

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/suite"

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

	resourceFinder, err := NewResourceFinder(logging.New(), rmdTestTarget)
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

	resourceFinder, err := NewResourceFinder(logging.New(), rmdTestTarget)
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
