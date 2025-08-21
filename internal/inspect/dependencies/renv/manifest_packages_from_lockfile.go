package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
)

// LockfilePackageMapper provides a way to map renv.lock packages to manifest packages
// without requiring the R packages to be installed in the library
type LockfilePackageMapper struct {
	base util.AbsolutePath
	log  logging.Logger
}

// NewLockfilePackageMapper creates a new LockfilePackageMapper
func NewLockfilePackageMapper(base util.AbsolutePath, log logging.Logger) *LockfilePackageMapper {
	return &LockfilePackageMapper{
		base: base,
		log:  log,
	}
}

// GetManifestPackagesFromLockfile reads the renv.lock file and converts it directly to manifest packages
// without requiring the R packages to be installed in a library
func (m *LockfilePackageMapper) GetManifestPackagesFromLockfile(
	lockfilePath util.AbsolutePath) (bundles.PackageMap, error) {

	lockfile, err := ReadLockfile(lockfilePath)
	if err != nil {
		return nil, err
	}

	// This will hold our manifest packages
	manifestPackages := bundles.PackageMap{}

	// Pre-compute repository lookups from lockfile
	repoNameByURL := map[string]string{}
	cranRepoURL := ""
	biocRepoURLs := []string{}
	for _, r := range lockfile.R.Repositories {
		url := strings.TrimRight(string(r.URL), "/")
		repoNameByURL[url] = r.Name
		if r.Name == "CRAN" && cranRepoURL == "" {
			cranRepoURL = url
		}
		if isBiocRepository(r) {
			biocRepoURLs = append(biocRepoURLs, url)
		}
	}

	// Also derive standard Bioconductor repos from the Bioconductor.Version field when present.
	// This covers lockfiles that only record the version without listing BioC URLs in R.Repositories.
	if lockfile.Bioconductor.Version != "" {
		v := lockfile.Bioconductor.Version
		// Known BioC repo patterns
		candidates := map[string]string{
			"BioCsoft":      "https://bioconductor.org/packages/" + v + "/bioc",
			"BioCann":       "https://bioconductor.org/packages/" + v + "/data/annotation",
			"BioCexp":       "https://bioconductor.org/packages/" + v + "/data/experiment",
			"BioCworkflows": "https://bioconductor.org/packages/" + v + "/workflows",
			"BioCbooks":     "https://bioconductor.org/packages/" + v + "/books",
		}
		for name, url := range candidates {
			u := strings.TrimRight(url, "/")
			if _, seen := repoNameByURL[u]; !seen {
				repoNameByURL[u] = name
			}
			// Maintain a list of BioC URLs for default selection when needed
			already := false
			for _, existing := range biocRepoURLs {
				if existing == u {
					already = true
					break
				}
			}
			if !already {
				biocRepoURLs = append(biocRepoURLs, u)
			}
		}
	}

	// Choose a default Bioconductor repo when Bioconductor is in use
	defaultBiocURL := ""
	if lockfile.Bioconductor.Version != "" {
		defaultBiocURL = strings.TrimRight("https://bioconductor.org/packages/"+lockfile.Bioconductor.Version+"/bioc", "/")
	}

	// Resolve repository URL and canonical source name using precomputed maps.
	// See resolveRepoAndSource helper for implementation.

	// Process each package in the lockfile
	for pkgName, pkg := range lockfile.Packages {
		manifestPkg := &bundles.Package{
			Source:     pkg.Source,
			Repository: string(pkg.Repository),
		}

		// Normalize repository URL (trim trailing slash) for comparisons
		repoURL := strings.TrimRight(string(pkg.Repository), "/")

		// Remotes declared by renv (e.g. RemoteRepos/RemoteType)
		if string(pkg.Repository) == "" && pkg.RemoteRepos != "" && pkg.RemoteReposName != "" {
			manifestPkg.Source = pkg.RemoteReposName
			setIf(manifestPkg, "Repository", pkg.RemoteRepos)
		} else if string(pkg.Repository) == "" && pkg.RemoteType != "" {
			// Handle packages installed from remote sources (GitHub, GitLab, Bitbucket)
			manifestPkg.Source = pkg.RemoteType
			setIf(manifestPkg, "Repository", remoteRepoURL(pkg.RemoteType, pkg.RemotePkgRef))
		} else if pkg.Source == "Bioconductor" || pkg.Source == "Repository" || repoURL != "" {
			// Resolve Source and Repository via precomputed repository map
			resolvedSource, resolvedRepo, err := resolveRepoAndSource(repoNameByURL, cranRepoURL, defaultBiocURL, string(pkg.Repository), pkg.Source, string(pkgName))
			if err != nil {
				return nil, err
			}
			manifestPkg.Source = resolvedSource
			manifestPkg.Repository = resolvedRepo
		}

		// Create description record with the package name, version and other available metadata
		description := dcf.Record{
			"Package": string(pkgName),
			"Version": pkg.Version,
		}

		// Add common fields for R packages
		description["Type"] = "Package"

		// Add Title: prefer package Title, otherwise fallback to "<Source> R package"
		fallbackTitle := strings.TrimSpace(firstNonEmpty(manifestPkg.Source, pkg.Source) + " R package")
		description["Title"] = firstNonEmpty(pkg.Title, fallbackTitle)

		// Populate all other fields from the lockfile package into the DESCRIPTION
		copyAllFieldsToDesc(pkg, description)

		// Validate we resolved a usable Source
		if manifestPkg.Source == "" {
			return nil, fmt.Errorf("Package %s has an unresolved source; cannot generate manifest entry", pkgName)
		}
		// Validate we resolved a repository
		if manifestPkg.Repository == "" {
			return nil, fmt.Errorf("Package %s has an unresolved repository; cannot generate manifest entry", pkgName)
		}

		// Set the description in the manifest package
		manifestPkg.Description = description

		// Add to the package map
		manifestPackages[string(pkgName)] = *manifestPkg
	}

	return manifestPackages, nil
}

// copyAllFieldsToDesc copies Hash, Remote* and other relevant fields from the lockfile Package
// into the DESCRIPTION record when they are non-empty. Arrays are joined as comma-separated lists
// and some fields are mapped to their DESCRIPTION keys (e.g., AuthorsAtR -> Authors@R).

func copyAllFieldsToDesc(pkg Package, desc dcf.Record) {
	// Core metadata
	setIf(desc, "Hash", pkg.Hash)
	setIf(desc, "Authors@R", pkg.AuthorsAtR)
	setIf(desc, "Description", pkg.Description)
	setIf(desc, "License", pkg.License)
	setIf(desc, "Maintainer", pkg.Maintainer)
	setIf(desc, "VignetteBuilder", pkg.VignetteBuilder)
	setIf(desc, "RoxygenNote", pkg.RoxygenNote)
	setIf(desc, "Encoding", pkg.Encoding)
	setIf(desc, "NeedsCompilation", pkg.NeedsCompilation)
	setIf(desc, "Author", pkg.Author)
	setIf(desc, "SystemRequirements", pkg.SystemRequirements)

	// Remote metadata (explicit list for clarity and stability)
	setIf(desc, "RemoteType", pkg.RemoteType)
	setIf(desc, "RemotePkgRef", pkg.RemotePkgRef)
	setIf(desc, "RemoteRef", pkg.RemoteRef)
	setIf(desc, "RemoteRepos", pkg.RemoteRepos)
	setIf(desc, "RemoteReposName", pkg.RemoteReposName)
	setIf(desc, "RemotePkgPlatform", pkg.RemotePkgPlatform)
	setIf(desc, "RemoteSha", pkg.RemoteSha)

	// URLs: prefer GitHub defaults when applicable, otherwise use values in lockfile
	if pkg.RemoteType == "github" && pkg.RemotePkgRef != "" {
		setIf(desc, "URL", "https://github.com/"+pkg.RemotePkgRef)
		setIf(desc, "BugReports", "https://github.com/"+pkg.RemotePkgRef+"/issues")
	}
	setIf(desc, "URL", pkg.URL)
	setIf(desc, "BugReports", pkg.BugReports)

	// Special mapped config fields
	desc["Config/testthat/edition"] = firstNonEmpty(desc["Config/testthat/edition"], pkg.ConfigTesthat)
	desc["Config/Needs/website"] = firstNonEmpty(desc["Config/Needs/website"], pkg.ConfigNeeds)

	// Arrays: Imports, Suggests, Depends (from Requirements)
	setIf(desc, "Imports", strings.Join(pkg.Imports, ", "))
	setIf(desc, "Suggests", strings.Join(pkg.Suggests, ", "))
	if len(pkg.Requirements) > 0 {
		deps := make([]string, 0, len(pkg.Requirements))
		for _, dep := range pkg.Requirements {
			deps = append(deps, string(dep))
		}
		setIf(desc, "Depends", strings.Join(deps, ", "))
	}

	// Repository info from lockfile (if present)
	setIf(desc, "Repository", string(pkg.Repository))
}

// helper: identify bioconductor repository entries
func isBiocRepository(r Repository) bool {
	if r.Name != "" && strings.HasPrefix(r.Name, "BioC") {
		return true
	}
	u := strings.ToLower(string(r.URL))
	return strings.Contains(u, "bioconductor.org/packages/")
}

// firstNonEmpty returns the first non-empty string among a and b.
func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// remoteRepoURL builds a repository URL for known remote types.
func remoteRepoURL(remoteType, pkgRef string) string {
	if pkgRef == "" {
		return ""
	}
	switch remoteType {
	case "github":
		return "https://github.com/" + pkgRef
	case "gitlab":
		return "https://gitlab.com/" + pkgRef
	case "bitbucket":
		return "https://bitbucket.org/" + pkgRef
	default:
		return ""
	}
}

// setIf sets a destination if currently empty and new value is non-empty.
// Supported dst types:
//   - *bundles.Package with key (e.g., "Repository")
//   - dcf.Record with key as string (DESCRIPTION fields)
func setIf(dst any, key string, val string) {
	if val == "" {
		return
	}
	switch d := dst.(type) {
	case *bundles.Package:
		rv := reflect.ValueOf(d).Elem()
		f := rv.FieldByName(key)
		if f.String() == "" {
			f.SetString(val)
		}
		return
	case dcf.Record:
		if d[key] == "" {
			d[key] = val
		}
		return
	default:
		// Unsupported destination type; no-op by design
		return
	}
}

// resolveRepoAndSource resolves a repository URL and canonical source name using
// precomputed lockfile repository maps. It also translates the CRAN placeholder to
// the concrete CRAN URL and fills Bioconductor defaults from Bioconductor.Version
// when needed. Error messages match prior behavior.
func resolveRepoAndSource(
	repoNameByURL map[string]string,
	cranRepoURL string,
	defaultBiocURL string,
	repoStr string,
	src string,
	pkgName string,
) (string, string, error) {
	// Normalize and translate placeholders
	repoURL := strings.TrimRight(repoStr, "/")
	if repoStr == "CRAN" {
		if cranRepoURL == "" {
			return "", "", fmt.Errorf("CRAN package %s but no CRAN repository listed in renv.lock", pkgName)
		}
		repoURL = cranRepoURL
	}

	// Fill missing BioC repo from version when applicable
	if repoURL == "" && src == "Bioconductor" {
		if defaultBiocURL == "" {
			return "", "", fmt.Errorf("Bioconductor package %s has no repository and no Bioconductor repositories are listed in renv.lock", pkgName)
		}
		repoURL = defaultBiocURL
	}

	// Lookup canonical name from lockfile repositories
	name, ok := repoNameByURL[repoURL]
	if !ok || repoURL == "" {
		if repoURL == "" {
			return "", "", fmt.Errorf("Package %s has an unresolved repository; cannot generate manifest entry", pkgName)
		}
		return "", "", fmt.Errorf("Package %s references repository %s which is not listed in renv.lock R.repositories", pkgName, repoURL)
	}

	// Standardize Bioconductor source label in manifest
	resolvedSource := name
	lowerURL := strings.ToLower(repoURL)
	if src == "Bioconductor" || strings.HasPrefix(name, "BioC") || strings.Contains(lowerURL, "bioconductor.org/packages/") {
		resolvedSource = "Bioconductor"
	}

	return resolvedSource, repoURL, nil
}
