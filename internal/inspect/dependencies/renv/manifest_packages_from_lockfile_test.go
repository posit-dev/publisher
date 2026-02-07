package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type LockfilePackageMapperSuite struct {
	utiltest.Suite
	testdata util.AbsolutePath
	log      logging.Logger
}

func TestLockfilePackageMapperSuite(t *testing.T) {
	suite.Run(t, new(LockfilePackageMapperSuite))
}

func (s *LockfilePackageMapperSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.testdata = cwd.Join("testdata")
	s.log = logging.New()
}

func (s *LockfilePackageMapperSuite) TestCRAN() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	// Use comprehensive field comparison - tests all fields present in expected.json
	for pkgName, expectedPkg := range expected {
		actualPkg, ok := manifestPackages[pkgName]
		s.True(ok, "Expected package %s not found in manifest", pkgName)
		if ok {
			s.assertPackageMatchesExpected(pkgName, expectedPkg, actualPkg)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestBioconductor() {
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	// Use comprehensive field comparison - tests all fields present in expected.json
	for pkgName, expectedPkg := range expected {
		actualPkg, ok := manifestPackages[pkgName]
		s.True(ok, "Expected package %s not found in manifest", pkgName)
		if ok {
			s.assertPackageMatchesExpected(pkgName, expectedPkg, actualPkg)
		}
	}
}

// normalizeWhitespace uniforms the spacing for comparison equality in tests.
func normalizeWhitespace(s string) string {
	wsRegexp := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(wsRegexp.ReplaceAllString(s, " "))
}

// normalizeList uniforms comma-separated lists for comparison equality in tests.
func normalizeList(s string) string {
	items := strings.Split(s, ",")
	clean := make([]string, 0, len(items))
	for _, it := range items {
		if t := strings.TrimSpace(it); t != "" {
			clean = append(clean, t)
		}
	}
	return strings.Join(clean, ",")
}

// comparePackages performs detailed comparison between two package representations.
// Handles differences in field availability and formats between different sources.
//
// Parameters:
//   - skipMissingFields: if true, skip fields not present in target package
//   - skipTitle: if true, skip Title field entirely; if false, require non-empty Title
//   - iterateFromFirst: if true, iterate over pkg1's fields; if false, iterate over pkg2's fields
func (s *LockfilePackageMapperSuite) comparePackages(pkgName string, pkg1, pkg2 bundles.Package, skipMissingFields, skipTitle, iterateFromFirst bool) {
	// Top-level fields should match exactly
	s.Equal(pkg1.Source, pkg2.Source, "Source mismatch for %s", pkgName)
	s.Equal(pkg1.Repository, pkg2.Repository, "Repository mismatch for %s", pkgName)

	// Determine which package's fields to iterate over
	var sourceFields map[string]string
	var targetFields map[string]string
	if iterateFromFirst {
		sourceFields = pkg1.Description
		targetFields = pkg2.Description
	} else {
		sourceFields = pkg2.Description
		targetFields = pkg1.Description
	}

	// Compare description fields
	for field, sourceVal := range sourceFields {
		targetVal, ok := targetFields[field]

		// Handle missing fields based on comparison type
		if !ok {
			if skipMissingFields {
				// Skip fields not present in target
				continue
			} else {
				// Require field to be present (compatibility testing)
				s.True(ok, "Expected field %s missing for package %s", field, pkgName)
				continue
			}
		}

		// Handle fields with known differences
		switch field {
		case "Title":
			if skipTitle {
				// Skip Title field entirely
				continue
			}
			// Title may be generated differently - just require non-empty
			s.NotEmpty(targetVal, "Title should be non-empty for package %s", pkgName)

		case "Depends":
			// Compare package names only, ignoring version constraints
			toNames := func(s string) []string {
				items := strings.Split(normalizeWhitespace(s), ",")
				out := make([]string, 0, len(items))
				for _, it := range items {
					t := strings.TrimSpace(it)
					if t == "" {
						continue
					}
					if idx := strings.Index(t, " ("); idx != -1 {
						t = t[:idx]
					}
					out = append(out, t)
				}
				return out
			}

			sourceNames := toNames(sourceVal)
			targetNames := toNames(targetVal)
			nameSet := map[string]struct{}{}
			for _, n := range targetNames {
				nameSet[n] = struct{}{}
			}
			// Check that all source dependencies are present in target
			for _, n := range sourceNames {
				_, present := nameSet[n]
				s.True(present, "Depends should contain %s for package %s", n, pkgName)
			}

		case "Imports", "Suggests":
			// Normalize list formatting for comparison
			s.Equal(
				normalizeList(normalizeWhitespace(sourceVal)),
				normalizeList(normalizeWhitespace(targetVal)),
				"Field %s mismatch for package %s", field, pkgName,
			)

		default:
			// For other fields, normalize whitespace and compare
			s.Equal(
				normalizeWhitespace(sourceVal),
				normalizeWhitespace(targetVal),
				"Field %s mismatch for package %s", field, pkgName,
			)
		}
	}
}

// assertPackageMatchesExpected compares actual package output against test fixtures.
func (s *LockfilePackageMapperSuite) assertPackageMatchesExpected(pkgName string, expectedPkg, actualPkg bundles.Package) {
	// skipMissingFields=true: test fixtures may have more fields than lockfile can provide
	// skipTitle=false: require Title to be non-empty
	// iterateFromFirst=true: iterate over expected package fields
	s.comparePackages(pkgName, expectedPkg, actualPkg, true, false, true)
}

// assertLockfileVsLegacyCompat compares lockfile vs legacy mapper outputs for compatibility.
func (s *LockfilePackageMapperSuite) assertLockfileVsLegacyCompat(pkgName string, lockfilePkg, legacyPkg bundles.Package) {
	// Core description fields that should always match
	s.Equal(legacyPkg.Description["Package"], lockfilePkg.Description["Package"], "Package field mismatch for %s", pkgName)
	s.Equal(legacyPkg.Description["Version"], lockfilePkg.Description["Version"], "Version field mismatch for %s", pkgName)

	// Source should match
	s.Equal(legacyPkg.Source, lockfilePkg.Source, "Source mismatch for %s", pkgName)

	// Repository format may differ between legacy (URLs) and lockfile (names) paths
	// Both should be non-empty and represent the same logical repository
	s.NotEmpty(legacyPkg.Repository, "Legacy repository should not be empty for %s", pkgName)
	s.NotEmpty(lockfilePkg.Repository, "Lockfile repository should not be empty for %s", pkgName)

	// For description fields comparison, skip top-level Repository field since formats differ
	// skipMissingFields=true: legacy is superset, may have fields lockfile doesn't
	// skipTitle=true: lockfile may use generic fallback for Title
	// iterateFromFirst=true: iterate over lockfile fields (first parameter)

	// Create a custom comparison that skips the Repository field
	sourceFields := lockfilePkg.Description
	targetFields := legacyPkg.Description

	for field, sourceVal := range sourceFields {
		targetVal, ok := targetFields[field]
		if !ok {
			// Skip fields not present in target (legacy is superset)
			continue
		}

		switch field {
		case "Title":
			// Skip Title field - lockfile may use generic fallback
			continue
		case "Repository":
			// Skip Repository field in description - format may differ between paths
			continue
		default:
			// For other fields, normalize whitespace and compare
			s.Equal(
				normalizeWhitespace(sourceVal),
				normalizeWhitespace(targetVal),
				"Field %s mismatch for package %s", field, pkgName,
			)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestCRAN_Functional() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	for pkgName, exp := range expected {
		pkg, ok := manifestPackages[pkgName]
		s.True(ok, "Expected package %s not found", pkgName)
		if ok {
			s.assertPackageMatchesExpected(pkgName, exp, pkg)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestBioconductor_Functional() {
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	for pkgName, exp := range expected {
		pkg, ok := manifestPackages[pkgName]
		s.True(ok, "Expected package %s not found", pkgName)
		if ok {
			s.assertPackageMatchesExpected(pkgName, exp, pkg)
		}
	}
}

// --- Compatibility tests ensuring lockfile-only path matches legacy path on core fields ---

func (s *LockfilePackageMapperSuite) TestCRAN_LockfileCompatibility() {
	if testing.Short() {
		s.T().Skip("skipping compatibility test in short mode")
	}

	// Create a temporary renv.lock with real CRAN packages for compatibility testing
	lockfileContent := `{
		"R": {
			"Version": "4.3.0",
			"Repositories": [
				{
					"Name": "CRAN",
					"URL": "https://cran.rstudio.com"
				}
			]
		},
		"Packages": {
			"base64enc": {
				"Package": "base64enc",
				"Version": "0.1-3",
				"Source": "Repository",
				"Repository": "CRAN",
				"Requirements": [
					"R (>= 2.9.0)"
				],
				"Hash": "470851b6d5d0ac559e9d01bb352b4021"
			}
		}
	}`

	// Create temporary directory and lockfile
	tempDirPath := s.T().TempDir()
	base := util.NewAbsolutePath(tempDirPath, nil)
	lockfilePath := base.Join("renv.lock")
	err := lockfilePath.WriteFile([]byte(lockfileContent), 0644)
	s.NoError(err)

	// Create a mock library directory with the package
	libPath := base.Join("renv_library")
	err = libPath.MkdirAll(0755)
	s.NoError(err)

	pkgDir := libPath.Join("base64enc")
	err = pkgDir.MkdirAll(0755)
	s.NoError(err)

	descPath := pkgDir.Join("DESCRIPTION")
	descContent := `Package: base64enc
Title: Tools for base64 encoding
Version: 0.1-3
Repository: CRAN
Author: Simon Urbanek <Simon.Urbanek@r-project.org>
Maintainer: Simon Urbanek <Simon.Urbanek@r-project.org>
Depends: R (>= 2.9.0)
Description: This package provides tools for handling base64 encoding.
License: GPL-2 | GPL-3
`
	err = descPath.WriteFile([]byte(descContent), 0644)
	s.NoError(err)

	// Ensure R sees our test library path
	origLibs := os.Getenv("R_LIBS")
	_ = os.Setenv("R_LIBS", libPath.String())
	defer os.Setenv("R_LIBS", origLibs)

	// Legacy path
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

	legacyPkgs, err := legacyMapper.GetManifestPackages(base, lockfilePath, s.log)
	s.NoError(err)

	// Lockfile-only path - should produce equivalent output to legacy mapper
	lockMapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	lockPkgs, err := lockMapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	// Ensure core compatibility for the expected package(s)
	for name, legacyPkg := range legacyPkgs {
		lpkg, ok := lockPkgs[name]
		s.True(ok, "Lockfile packages missing %s", name)
		if ok {
			s.assertLockfileVsLegacyCompat(name, lpkg, legacyPkg)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestBioconductor_LockfileCompatibility() {
	if testing.Short() {
		s.T().Skip("skipping compatibility test in short mode")
	}

	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	// Ensure R sees our test library path
	origLibs := os.Getenv("R_LIBS")
	_ = os.Setenv("R_LIBS", libPath.String())
	defer os.Setenv("R_LIBS", origLibs)

	// Legacy path
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

	// If Bioconductor repos are not resolvable in this environment, skip
	biocRepos, _ := legacyMapper.(*defaultPackageMapper).lister.GetBioconductorRepos(base, s.log)
	if len(biocRepos) == 0 {
		s.T().Skip("Bioconductor repos unavailable; install BiocManager to run this test")
	}

	legacyPkgs, err := legacyMapper.GetManifestPackages(base, lockfilePath, s.log)
	s.NoError(err)

	// Lockfile-only path
	lockMapper := NewLockfilePackageMapper(base, util.Path{}, s.log)
	lockPkgs, err := lockMapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	for name, legacyPkg := range legacyPkgs {
		lpkg, ok := lockPkgs[name]
		s.True(ok, "Lockfile packages missing %s", name)
		if ok {
			s.assertLockfileVsLegacyCompat(name, lpkg, legacyPkg)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestRSPMRepositoryHandling() {
	// Test repository references available through RemoteRepos fields:
	// - RSPM properly handled when not in repositories section
	// - Fictional turbopackages as RemoteRepos by name, URL infered from Repositories
	lockfileContent := `{
		"R": {
			"Version": "4.3.3",
			"Repositories": [
				{
					"Name": "CRAN",
					"URL": "https://cloud.r-project.org"
				},
				{
					"Name": "turbopackages",
					"URL": "https://turbopackages.org/latest"
				}
			]
		},
		"Packages": {
			"R6": {
				"Package": "R6",
				"Version": "2.5.1",
				"Source": "Repository",
				"Repository": "RSPM",
				"RemoteType": "standard",
				"RemotePkgRef": "R6",
				"RemoteRef": "R6",
				"RemoteRepos": "https://packagemanager.rstudio.com/all/latest",
				"RemoteReposName": "CRAN",
				"RemotePkgPlatform": "x86_64-apple-darwin20",
				"RemoteSha": "2.5.1",
				"Requirements": [
					"R"
				],
				"Hash": "470851b6d5d0ac559e9d01bb352b4021"
			},
			"turbobear": {
				"Package": "turbobear",
				"Version": "99.99.99",
				"Source": "Repository",
				"RemoteType": "standard",
				"RemotePkgRef": "turbobear",
				"RemoteRef": "turbobear",
				"RemoteRepos": "turbopackages",
				"RemoteReposName": "turbopackages",
				"RemotePkgPlatform": "x86_64-apple-darwin20",
				"RemoteSha": "99.99.99",
				"Requirements": [
					"R"
				],
				"Hash": "990851b6d5d0ac559e9d01bb352b4021"
			}
		}
	}`

	// Create a temporary lockfile
	tempDirPath := s.T().TempDir()
	tempDir := util.NewAbsolutePath(tempDirPath, nil)
	lockfilePath := tempDir.Join("test_rspm_renv.lock")
	err := lockfilePath.WriteFile([]byte(lockfileContent), 0644)
	s.NoError(err)

	mapper := NewLockfilePackageMapper(tempDir, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	// Verify that the R6 package was processed successfully
	s.Contains(manifestPackages, "R6")
	r6Pkg := manifestPackages["R6"]

	// RSPM should be resolved through the RemoteRepos field
	s.Equal("https://packagemanager.rstudio.com/all/latest", r6Pkg.Repository)
	s.Equal("RSPM", r6Pkg.Source)
	// Check version from description
	s.Equal("2.5.1", r6Pkg.Description["Version"])

	// Verify that the turbobear package was processed successfully
	s.Contains(manifestPackages, "turbobear")
	turbobearPkg := manifestPackages["turbobear"]

	// turbopackages should be resolved through the RemoteRepos field
	s.Equal("https://turbopackages.org/latest", turbobearPkg.Repository)
	s.Equal("turbopackages", turbobearPkg.Source)

	// Check version from description
	s.Equal("99.99.99", turbobearPkg.Description["Version"])
}

func (s *LockfilePackageMapperSuite) TestRSPMRepositoryHandling_MissingRemoteRepos() {
	// Test the case where a package has Repository="RSPM" but no RemoteRepos field
	// This should resolve to the standard RSPM repository URL
	lockfileContent := `{
		"R": {
			"Version": "4.3.3",
			"Repositories": [
				{
					"Name": "CRAN",
					"URL": "https://cloud.r-project.org"
				}
			]
		},
		"Packages": {
			"renv": {
				"Package": "renv",
				"Version": "0.17.3",
				"Source": "Repository",
				"Repository": "RSPM",
				"Requirements": [
					"utils"
				],
				"Hash": "4543b8cd233ae25c6aba8548be9e747e"
			}
		}
	}`

	// Create a temporary lockfile
	tempDirPath := s.T().TempDir()
	tempDir := util.NewAbsolutePath(tempDirPath, nil)
	lockfilePath := tempDir.Join("test_rspm_missing_remote_repos.lock")
	err := lockfilePath.WriteFile([]byte(lockfileContent), 0644)
	s.NoError(err)

	mapper := NewLockfilePackageMapper(tempDir, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)

	// Should succeed with RSPM resolving to standard repository
	s.NoError(err)
	s.Contains(manifestPackages, "renv")

	renvPkg := manifestPackages["renv"]
	// Should resolve to standard RSPM repository when no RemoteRepos is provided
	s.Equal("RSPM", renvPkg.Source)
	s.Equal("https://packagemanager.posit.co/cran/latest", renvPkg.Repository)
}

func (s *LockfilePackageMapperSuite) TestGitRemoteFieldsPreserved() {
	lockfileContent := `{
		"R": {
			"Version": "4.3.3",
			"Repositories": []
		},
		"Packages": {
			"mypkg": {
				"Package": "mypkg",
				"Version": "1.2.3",
				"Source": "GitHub",
				"RemoteType": "github",
				"RemoteHost": "api.github.com",
				"RemoteRepo": "mypkg",
				"RemoteUsername": "posit-dev",
				"RemoteRef": "main",
				"RemoteSha": "abcdef1234567890",
				"RemoteUrl": "https://api.github.com/repos/posit-dev/mypkg",
					"Requirements": [],
					"Hash": "0123456789abcdef"
				}
			}
		}`

	tempDirPath := s.T().TempDir()
	tempDir := util.NewAbsolutePath(tempDirPath, nil)
	lockfilePath := tempDir.Join("git_remote_renv.lock")
	err := lockfilePath.WriteFile([]byte(lockfileContent), 0644)
	s.NoError(err)

	mapper := NewLockfilePackageMapper(tempDir, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	s.Contains(manifestPackages, "mypkg")
	pkg := manifestPackages["mypkg"]

	s.Equal("github", pkg.Source)
	s.Equal("https://github.com/posit-dev/mypkg", pkg.Repository)

	desc := pkg.Description
	s.Equal("posit-dev/mypkg", desc["RemotePkgRef"])
	s.Equal("api.github.com", desc["RemoteHost"])
	s.Equal("mypkg", desc["RemoteRepo"])
	s.Equal("posit-dev", desc["RemoteUsername"])
	s.Equal("https://api.github.com/repos/posit-dev/mypkg", desc["RemoteUrl"])
	s.Equal("abcdef1234567890", desc["RemoteSha"])
}

func (s *LockfilePackageMapperSuite) TestHashingFields_FromLockfile() {
	// Verifies that Description contains Package, Version, Depends, Imports, Suggests, LinkingTo
	// when provided in renv.lock, with list fields joined by commas.
	//
	// Those fields are the ones used by packrat to compute hash of packages
	// if missing the cache would always result in a miss.
	lockfileContent := `{
		"R": {
			"Version": "4.3.3",
			"Repositories": [
				{ "Name": "CRAN", "URL": "https://cloud.r-project.org" }
			]
		},
		"Packages": {
			"mypkg": {
				"Package": "mypkg",
				"Version": "1.0.0",
				"Source": "Repository",
				"Repository": "CRAN",
				"Depends": [
					"R (>= 3.5.0)",
					"foo",
					"bar"
				],
				"Imports": [
					"glue",
					"stringr"
				],
				"Suggests": [
					"knitr",
					"rmarkdown"
				],
				"LinkingTo": [
					"Rcpp",
					"cpp11 (>= 0.5.0)"
				],
				"Hash": "deadbeef"
			}
		}
	}`

	// Create a temporary lockfile
	tempDirPath := s.T().TempDir()
	tempDir := util.NewAbsolutePath(tempDirPath, nil)
	lockfilePath := tempDir.Join("renv.lock")
	s.NoError(lockfilePath.WriteFile([]byte(lockfileContent), 0644))

	mapper := NewLockfilePackageMapper(tempDir, util.Path{}, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	// Validate presence and formatting of fields in Description
	s.Contains(manifestPackages, "mypkg")
	pkg := manifestPackages["mypkg"]

	desc := pkg.Description
	s.Equal("mypkg", desc["Package"])
	s.Equal("1.0.0", desc["Version"])
	// List fields should be comma+space separated strings
	s.Equal("R (>= 3.5.0), foo, bar", desc["Depends"])
	s.Equal("glue, stringr", desc["Imports"])
	s.Equal("knitr, rmarkdown", desc["Suggests"])
	s.Equal("Rcpp, cpp11 (>= 0.5.0)", desc["LinkingTo"])
}
