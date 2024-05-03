package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"slices"
	"strconv"
	"strings"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/dcf"
)

type PackageMapper interface {
	GetManifestPackages(base util.AbsolutePath, lockfilePath util.AbsolutePath) (bundles.PackageMap, error)
}

type defaultPackageMapper struct {
	lister AvailablePackagesLister
}

func NewPackageMapper(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) *defaultPackageMapper {
	return &defaultPackageMapper{
		lister: NewAvailablePackageLister(base, rExecutable, log),
	}
}

func findAvailableVersion(pkgName PackageName, availablePackages []AvailablePackage) string {
	for _, avail := range availablePackages {
		if avail.Name == pkgName {
			return avail.Version
		}
	}
	return ""
}

func package_version(vs string) []int {
	// https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/numeric_version
	// "Numeric versions are sequences of one or more non-negative integers,
	// usually represented as character strings with the elements of the sequence
	// concatenated and separated by single . or - characters"
	parts := strings.FieldsFunc(vs, func(c rune) bool {
		return c >= '0' && c <= '9'
	})
	values := []int{}
	for _, part := range parts {
		// There shouldn't be any invalid parts because we only took digits
		v, _ := strconv.Atoi(part)
		values = append(values, v)
	}
	return values
}

func isDevVersion(pkg *Package, availablePackages []AvailablePackage) bool {
	// A package is a dev version if it's newer than the one
	// available in the configured repositories.
	repoVersion := findAvailableVersion(pkg.Package, availablePackages)
	if repoVersion == "" {
		return false
	}
	cmp := slices.Compare(package_version(pkg.Version), package_version(repoVersion))
	return cmp > 0
}

func findRepoName(repoUrl RepoURL, repos []Repository) string {
	for _, repo := range repos {
		if repo.URL == repoUrl {
			return repo.Name
		}
	}
	return ""
}

func findRepoUrl(pkgName PackageName, availablePackages []AvailablePackage) string {
	for _, avail := range availablePackages {
		if avail.Name == pkgName {
			return avail.Repository
		}
	}
	return ""
}

func toManifestPackage(pkg *Package, repos []Repository, availablePackages, biocPackages []AvailablePackage) *bundles.Package {
	// See rsconnect:::standardizeRenvPackage
	out := &bundles.Package{
		Source:     pkg.Source,
		Repository: string(pkg.Repository),
	}
	source := pkg.Source

	if pkg.Repository == "" && strings.Contains(pkg.RemoteRepos, "bioconductor.org") {
		// Workaround for https://github.com/rstudio/renv/issues/1202
		source = "Bioconductor"
	}

	switch source {
	case "Repository":
		if pkg.Repository == "CRAN" {
			if isDevVersion(pkg, availablePackages) {
				out.Source = ""
				out.Repository = ""
			} else {
				out.Source = "CRAN"
				out.Repository = findRepoUrl(pkg.Package, availablePackages)
			}
		} else {
			// Repository comes from DESCRIPTION and is set by repo, so can be
			// anything. So we must look up from the package name.
			out.Source = findRepoName(pkg.Repository, repos)
			out.Repository = findRepoUrl(pkg.Package, availablePackages)
		}
	case "Bioconductor":
		out.Repository = findRepoUrl(pkg.Package, availablePackages)
		if out.Repository == "" {
			// Try packages defined from default bioC repos
			out.Repository = findRepoUrl(pkg.Package, biocPackages)
		}
	case "Bitbucket", "GitHub", "GitLab":
		out.Source = strings.ToLower(pkg.Source)
	case "Local", "unknown":
		out.Source = ""
		out.Repository = ""
	}
	return out
}

var errBadDescription = errors.New("invalid DESCRIPTION file")
var errPackageNotFound = errors.New("package not found in current libPaths")

func readPackageDescription(name PackageName, libPaths []util.AbsolutePath) (dcf.Record, error) {
	reader := dcf.NewFileReader()
	for _, libPath := range libPaths {
		descPath := libPath.Join(string(name), "DESCRIPTION")
		descRecords, err := reader.ReadFile(descPath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				// Try next libPath
				continue
			} else {
				return nil, err
			}
		}
		if len(descRecords) != 1 {
			return nil, fmt.Errorf("%s: %w", descPath.String(), errBadDescription)
		}
		return descRecords[0], nil
	}
	return nil, fmt.Errorf("%s: %w", name, errPackageNotFound)
}

var errLockfileLibraryMismatch = errors.New("library and lockfile are out of sync. Use renv::restore() or renv::snapshot() to synchronize")

func (m *defaultPackageMapper) GetManifestPackages(
	base util.AbsolutePath,
	lockfilePath util.AbsolutePath) (bundles.PackageMap, error) {

	lockfile, err := ReadLockfile(lockfilePath)
	if err != nil {
		return nil, err
	}

	libPaths, err := m.lister.GetLibPaths()
	if err != nil {
		return nil, err
	}

	repos := lockfile.R.Repositories
	available, err := m.lister.ListAvailablePackages(repos)
	if err != nil {
		return nil, err
	}

	biocRepos, err := m.lister.GetBioconductorRepos(base)
	if err != nil {
		return nil, err
	}

	biocPackages := []AvailablePackage{}
	if len(biocRepos) > 0 {
		biocPackages, err = m.lister.ListAvailablePackages(biocRepos)
		if err != nil {
			return nil, err
		}
	}

	manifestPackages := bundles.PackageMap{}
	for _, pkg := range lockfile.Packages {
		manifestPkg := toManifestPackage(&pkg, repos, available, biocPackages)
		description, err := readPackageDescription(pkg.Package, libPaths)
		if err != nil {
			return nil, err
		}
		if description["Version"] != pkg.Version {
			return nil, fmt.Errorf("package %s: lockfile version '%s', library version '%s': %w",
				pkg.Package, pkg.Version, description["Version"], errLockfileLibraryMismatch)
		}
		manifestPkg.Description = description
		manifestPackages[string(pkg.Package)] = *manifestPkg
	}
	return manifestPackages, nil
}
