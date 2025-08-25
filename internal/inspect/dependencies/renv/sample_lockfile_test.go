package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type SampleLockfileSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestSampleLockfileSuite(t *testing.T) {
	suite.Run(t, new(SampleLockfileSuite))
}

func (s *SampleLockfileSuite) SetupTest() {
	s.log = logging.New()
}

func (s *SampleLockfileSuite) TestSample() {
	// Get the current directory
	cwd, err := util.Getwd(nil)
	s.NoError(err)

	// Create paths to test data files
	lockfilePath := cwd.Join("testdata", "sample-renv.lock")
	manifestPath := cwd.Join("testdata", "sample-manifest.json")

	// Parse the sample manifest.json file
	manifestBytes, err := manifestPath.ReadFile()
	s.NoError(err)

	var manifest bundles.Manifest
	err = json.Unmarshal(manifestBytes, &manifest)
	s.NoError(err)

	// Use our lockfile mapper to get the packages
	mapper := NewLockfilePackageMapper(cwd, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	// Note: The renv.lock file may contain more packages than the manifest.json file,
	// since it includes system packages and tools like renv, packrat, rsconnect, and rstudioapi

	// Make sure all packages from manifest are in our generated packages
	for pkgName, expectedPkg := range manifest.Packages {
		pkg, ok := manifestPackages[pkgName]
		s.True(ok, "Package %s from manifest should be in generated packages", pkgName)
		if ok {
			// Compare expected and actual packages

			s.Equal(expectedPkg.Source, pkg.Source)
			s.Equal(expectedPkg.Repository, pkg.Repository)
			s.Equal(expectedPkg.Description["Package"], pkg.Description["Package"])
			s.Equal(expectedPkg.Description["Version"], pkg.Description["Version"])

			// Test for Type field which should always be present
			s.Equal("Package", pkg.Description["Type"])

			// For Title, we're just checking that a title exists, not necessarily that it's the exact same
			s.NotEmpty(pkg.Description["Title"], "Package %s should have a Title", pkgName)

			// Check all additional fields if they exist in the expected package
			fieldsToCheck := []string{
				// Only fields expected to live under the Description map
				"Authors@R", "Description", "License", "URL", "BugReports",
				"Imports", "Suggests", "VignetteBuilder", "Config/Needs/website", "Config/testthat/edition",
				"Encoding", "RoxygenNote", "SystemRequirements", "NeedsCompilation", "Author",
				"Maintainer", "Repository",
			}

			for _, field := range fieldsToCheck {
				// fmt.Printf("Checking package %s field %s\n", pkgName, field)

				if expectedValue, exists := expectedPkg.Description[field]; exists && expectedValue != "" {
					actualValue, ok := pkg.Description[field]
					// Require the field to be present in the generated package if it exists in expected
					s.True(ok, "Field %s should be present for package %s", field, pkgName)
					if ok {

						if field == "Title" {
							// Already checked Title exists above; enforce non-empty here if encountered
							s.NotEmpty(actualValue, "Package %s should have a Title", pkgName)
						} else {
							// For all other fields, require non-empty and exact match
							s.NotEmpty(actualValue, "Field %s should not be empty for package %s", field, pkgName)

							// For fields that might have whitespace differences, normalize whitespace before comparison
							if field == "Authors@R" || field == "URL" || field == "Description" ||
								field == "Imports" || field == "Suggests" || field == "SystemRequirements" ||
								field == "Config/Needs/website" || field == "Author" {

								// Special handling for comma-separated lists like Imports, Suggests
								if field == "Imports" || field == "Suggests" {
									// First normalize all whitespace, including newlines
									wsRegexp := regexp.MustCompile(`\s+`)

									// Replace all whitespace with a single space
									normalizedExpected := wsRegexp.ReplaceAllString(expectedValue, " ")
									normalizedActual := wsRegexp.ReplaceAllString(actualValue, " ")

									// Then split by comma and normalize each item
									normalizeList := func(s string) string {
										// Split the string by comma
										items := strings.Split(s, ",")

										// Create a new slice for non-empty items
										nonEmptyItems := []string{}

										// Trim each item and add non-empty ones to our slice
										for i := range items {
											trimmed := strings.TrimSpace(items[i])
											if trimmed != "" {
												nonEmptyItems = append(nonEmptyItems, trimmed)
											}
										}

										// Join the items back with a comma (no space)
										return strings.Join(nonEmptyItems, ",")
									}

									normalizedExpected = normalizeList(normalizedExpected)
									normalizedActual = normalizeList(normalizedActual)

									s.Equal(normalizedExpected, normalizedActual,
										"Field %s with normalized list should match for package %s", field, pkgName)

								} else {
									// For other fields, normalize whitespace in both strings by:
									// 1. Replace newlines with spaces
									// 2. Replace multiple spaces with a single space
									// 3. Trim surrounding whitespace

									// Create regexp for consecutive whitespace characters
									wsRegexp := regexp.MustCompile(`\s+`)

									// Normalize expected and actual values
									normalizedExpected := strings.TrimSpace(wsRegexp.ReplaceAllString(expectedValue, " "))
									normalizedActual := strings.TrimSpace(wsRegexp.ReplaceAllString(actualValue, " "))

									s.Equal(normalizedExpected, normalizedActual,
										"Field %s with normalized whitespace should match for package %s", field, pkgName)
								}
							} else {
								s.Equal(expectedValue, actualValue, "Field %s should match for package %s", field, pkgName)
							}
						}
					}
				}
			}
		}
	}

	// Note: We are NOT checking that all packages from lockfile are in the manifest.
	// This is because the lockfile may contain packages that are not directly referenced
	// in the manifest.json, such as system packages or tools like renv, packrat, etc.
}
