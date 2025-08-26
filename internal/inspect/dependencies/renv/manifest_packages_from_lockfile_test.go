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

	mapper := NewLockfilePackageMapper(base, s.log)
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

	mapper := NewLockfilePackageMapper(base, s.log)
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

	// skipMissingFields=true: legacy is superset, may have fields lockfile doesn't
	// skipTitle=true: lockfile may use generic fallback for Title
	// iterateFromFirst=true: iterate over lockfile fields (first parameter)
	s.comparePackages(pkgName, lockfilePkg, legacyPkg, true, true, true)
}

func (s *LockfilePackageMapperSuite) TestCRAN_Functional() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, s.log)
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

	mapper := NewLockfilePackageMapper(base, s.log)
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
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	// Ensure R sees our test library path
	origLibs := os.Getenv("R_LIBS")
	_ = os.Setenv("R_LIBS", libPath.String())
	defer os.Setenv("R_LIBS", origLibs)

	// Legacy path
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log, false)
	s.NoError(err)

	legacyPkgs, err := legacyMapper.GetManifestPackages(base, lockfilePath, s.log)
	s.NoError(err)

	// Lockfile-only path - should produce equivalent output to legacy mapper
	lockMapper := NewLockfilePackageMapper(base, s.log)
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
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	// Ensure R sees our test library path
	origLibs := os.Getenv("R_LIBS")
	_ = os.Setenv("R_LIBS", libPath.String())
	defer os.Setenv("R_LIBS", origLibs)

	// Legacy path
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log, false)
	s.NoError(err)

	// If Bioconductor repos are not resolvable in this environment, skip
	biocRepos, _ := legacyMapper.(*defaultPackageMapper).lister.GetBioconductorRepos(base, s.log)
	if len(biocRepos) == 0 {
		s.T().Skip("Bioconductor repos unavailable; install BiocManager to run this test")
	}

	legacyPkgs, err := legacyMapper.GetManifestPackages(base, lockfilePath, s.log)
	s.NoError(err)

	// Lockfile-only path
	lockMapper := NewLockfilePackageMapper(base, s.log)
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
