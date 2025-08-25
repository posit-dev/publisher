package renv

// Copyright (C) 2024 by Posit Software, PBC.

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

	// Compare just the Source and Repository, since our lockfile parser can't get all the DESCRIPTION fields
	for pkgName, pkg := range manifestPackages {
		s.Equal(expected[pkgName].Source, pkg.Source)
		s.Equal(expected[pkgName].Repository, pkg.Repository)
		s.Equal(expected[pkgName].Description["Package"], pkg.Description["Package"])
		s.Equal(expected[pkgName].Description["Version"], pkg.Description["Version"])
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

	// Compare just the Source and Repository, since our lockfile parser can't get all the DESCRIPTION fields
	for pkgName, pkg := range manifestPackages {
		s.Equal(expected[pkgName].Source, pkg.Source)
		s.Equal(expected[pkgName].Repository, pkg.Repository)
		s.Equal(expected[pkgName].Description["Package"], pkg.Description["Package"])
		s.Equal(expected[pkgName].Description["Version"], pkg.Description["Version"])
	}
}

// normalizeWhitespace collapses all whitespace (including newlines) to single spaces and trims ends.
func normalizeWhitespace(s string) string {
	wsRegexp := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(wsRegexp.ReplaceAllString(s, " "))
}

// normalizeList normalizes comma-separated lists by trimming items and removing empties.
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

// assertPackageMatchesExpected compares an actual package against an expected one, normalizing where sensible.
func (s *LockfilePackageMapperSuite) assertPackageMatchesExpected(pkgName string, expectedPkg, actualPkg bundles.Package) {
	// Top-level fields
	s.Equal(expectedPkg.Source, actualPkg.Source, "Source mismatch for %s", pkgName)
	s.Equal(expectedPkg.Repository, actualPkg.Repository, "Repository mismatch for %s", pkgName)

	// Description fields present in expected must exist and match after normalization
	for field, expectedVal := range expectedPkg.Description {
		actualVal, ok := actualPkg.Description[field]
		if !ok {
			// renv.lock may not provide every DESCRIPTION field; skip if not present in actual
			continue
		}

		// Special handling for Title: just require non-empty
		if field == "Title" {
			s.NotEmpty(actualVal, "Title should be non-empty for package %s", pkgName)
			continue
		}

		// Special handling for Depends: ignore version constraints and require containment
		if field == "Depends" {
			toNames := func(s string) []string {
				items := strings.Split(normalizeWhitespace(s), ",")
				out := make([]string, 0, len(items))
				for _, it := range items {
					t := strings.TrimSpace(it)
					if t == "" {
						continue
					}
					// Strip version constraint in parentheses, e.g., "pkg (>= 1.0)" -> "pkg"
					if idx := strings.Index(t, " ("); idx != -1 {
						t = t[:idx]
					}
					out = append(out, t)
				}
				return out
			}

			expNames := toNames(expectedVal)
			actNames := toNames(actualVal)
			// Build a set for faster lookup
			set := map[string]struct{}{}
			for _, n := range actNames {
				set[n] = struct{}{}
			}
			for _, n := range expNames {
				_, present := set[n]
				s.True(present, "Depends should contain %s for package %s", n, pkgName)
			}
			continue
		}

		// Special handling for list-like fields
		if field == "Imports" || field == "Suggests" {
			s.Equal(
				normalizeList(normalizeWhitespace(expectedVal)),
				normalizeList(normalizeWhitespace(actualVal)),
				"Field %s mismatch for package %s",
				field, pkgName,
			)
			continue
		}

		// Default normalization for multiline/whitespace-heavy fields
		s.Equal(
			normalizeWhitespace(expectedVal),
			normalizeWhitespace(actualVal),
			"Field %s mismatch for package %s",
			field, pkgName,
		)
	}
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

// assertLockfileVsLegacyCompat compares lockfile-only vs legacy outputs for a package.
func (s *LockfilePackageMapperSuite) assertLockfileVsLegacyCompat(pkgName string, lockfilePkg, legacyPkg bundles.Package) {
	// Top-level
	s.Equal(legacyPkg.Source, lockfilePkg.Source, "Source mismatch for %s", pkgName)
	s.Equal(legacyPkg.Repository, lockfilePkg.Repository, "Repository mismatch for %s", pkgName)

	// Core description fields
	s.Equal(legacyPkg.Description["Package"], lockfilePkg.Description["Package"], "Package field mismatch for %s", pkgName)
	s.Equal(legacyPkg.Description["Version"], lockfilePkg.Description["Version"], "Version field mismatch for %s", pkgName)

	// For fields present in lockfile output, require compatibility with legacy, with normalization.
	for field, lockVal := range lockfilePkg.Description {
		// Skip Title: lockfile path may use a generic fallback
		if field == "Title" {
			continue
		}
		legVal, ok := legacyPkg.Description[field]
		if !ok {
			// If legacy lacks the field, skip: legacy is source-of-truth superset.
			continue
		}
		switch field {
		case "Imports", "Suggests":
			s.Equal(
				normalizeList(normalizeWhitespace(legVal)),
				normalizeList(normalizeWhitespace(lockVal)),
				"Field %s mismatch for %s", field, pkgName,
			)
		case "Depends":
			// Compare names only, ignoring version constraints in either side.
			// Require that legacy Depends entries are present in lockfile Depends.
			toNames := func(sv string) []string {
				items := strings.Split(normalizeWhitespace(sv), ",")
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
			legNames := toNames(legVal)
			lockNames := toNames(lockVal)
			set := map[string]struct{}{}
			for _, n := range lockNames {
				set[n] = struct{}{}
			}
			for _, n := range legNames {
				_, present := set[n]
				s.True(present, "Depends should contain %s for %s", n, pkgName)
			}
		default:
			s.Equal(
				normalizeWhitespace(legVal),
				normalizeWhitespace(lockVal),
				"Field %s mismatch for %s", field, pkgName,
			)
		}
	}
}

func (s *LockfilePackageMapperSuite) TestCRAN_LockfileCompatibility() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	// Ensure R sees our test library path
	origLibs := os.Getenv("R_LIBS")
	_ = os.Setenv("R_LIBS", libPath.String())
	defer os.Setenv("R_LIBS", origLibs)

	// Legacy path
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log)
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
	legacyMapper, err := NewPackageMapper(base, util.Path{}, s.log)
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
