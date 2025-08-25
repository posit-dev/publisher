package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
)

// LockfilePackageMapper enables deployment without requiring R packages to be
// installed locally.
// This is useful because it does not require a specific R environment to be set up
// and aligned with the renv.lock file.
// It provides an alternative to defaultPackageMapper which requires installed R libraries.
type LockfilePackageMapper struct {
	base util.AbsolutePath
	log  logging.Logger
}

func NewLockfilePackageMapper(base util.AbsolutePath, log logging.Logger) *LockfilePackageMapper {
	return &LockfilePackageMapper{
		base: base,
		log:  log,
	}
}

// GetManifestPackagesFromLockfile extracts package information directly from renv.lock
// without requiring installed R packages. This contrasts with defaultPackageMapper.GetManifestPackages
// which reads DESCRIPTION files from installed R libraries. Both approaches must produce
// equivalent manifest output for the same renv.lock to ensure deployment consistency.
func (m *LockfilePackageMapper) GetManifestPackagesFromLockfile(
	lockfilePath util.AbsolutePath) (bundles.PackageMap, error) {

	lockfile, err := ReadLockfile(lockfilePath)
	if err != nil {
		return nil, err
	}

	manifestPackages := bundles.PackageMap{}

	// Repository lookups are pre-computed because LockfilePackageMapper must normalize repository
	// references consistently to produce the same output format as defaultPackageMapper.
	// Both approaches handle packages that may reference repositories by name ("CRAN") or URL.
	repoNameByURL := map[string]string{}
	cranRepoURL := ""
	for _, r := range lockfile.R.Repositories {
		url := strings.TrimRight(string(r.URL), "/")
		repoNameByURL[url] = r.Name
		if r.Name == "CRAN" && cranRepoURL == "" {
			cranRepoURL = url
		}
	}

	// Bioconductor repositories must be derived from version information when missing
	// because renv sometimes only records the version without explicit repository URLs,
	// but we need resolvable URLs for consistent deployment across environments.
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
		}
	}

	// Default Bioconductor repository selection is needed because packages may reference
	// "Bioconductor" as a source without specifying which specific BioC repository
	defaultBiocURL := ""
	if lockfile.Bioconductor.Version != "" {
		defaultBiocURL = strings.TrimRight("https://bioconductor.org/packages/"+lockfile.Bioconductor.Version+"/bioc", "/")
	}

	// Repository resolution is delegated to resolveRepoAndSource to ensure LockfilePackageMapper
	// and defaultPackageMapper produce identical normalization (URLs converted to repository names).

	for pkgName, pkg := range lockfile.Packages {
		manifestPkg := &bundles.Package{
			Source:     pkg.Source,
			Repository: string(pkg.Repository),
		}

		// Repository URL normalization is required for consistent comparisons because
		// different sources may use trailing slashes inconsistently, but we need
		// exact matches when looking up repository names.
		repoURL := strings.TrimRight(string(pkg.Repository), "/")

		// Remote package handling covers git-based sources that don't use traditional
		// repositories but still need to be deployable with their remote URLs.
		if string(pkg.Repository) == "" && pkg.RemoteRepos != "" && pkg.RemoteReposName != "" {
			manifestPkg.Source = pkg.RemoteReposName
			setIf(manifestPkg, "Repository", pkg.RemoteRepos)
		} else if string(pkg.Repository) == "" && pkg.RemoteType != "" {
			// Git-hosted packages (GitHub, GitLab, etc.) need special URL construction
			// because they don't follow standard repository conventions.
			manifestPkg.Source = pkg.RemoteType
			setIf(manifestPkg, "Repository", remoteRepoURL(pkg.RemoteType, pkg.RemotePkgRef))
		} else if pkg.Source == "Bioconductor" || pkg.Source == "Repository" || repoURL != "" {
			// Standard repository packages require normalization to ensure LockfilePackageMapper
			// and defaultPackageMapper produce equivalent output with repository names (not URLs).
			resolvedSource, resolvedRepo, err := resolveRepoAndSource(repoNameByURL, cranRepoURL, defaultBiocURL, string(pkg.Repository), pkg.Source, string(pkgName))
			if err != nil {
				return nil, err
			}
			manifestPkg.Source = resolvedSource
			manifestPkg.Repository = resolvedRepo
		}

		// DESCRIPTION record construction follows R package conventions because
		// deployment targets expect standard package metadata format.
		description := dcf.Record{
			"Package": string(pkgName),
			"Version": pkg.Version,
		}

		// Package type standardization is required because deployment environments
		// expect consistent metadata regardless of the source lockfile format.
		description["Type"] = "Package"

		// Title fallback ensures every package has a descriptive title for deployment
		// environments that display package information to users.
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

// copyAllFieldsToDesc transfers metadata from lockfile packages to DESCRIPTION format
// because deployment environments expect R package metadata in the standard DESCRIPTION
// format, not the renv.lock JSON format. This ensures compatibility across tools.

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

	// URLs: GitHub packages need special URL construction because they follow
	// different conventions than traditional R repositories, and deployment
	// environments benefit from having direct links to source and issue tracking.
	if pkg.RemoteType == "github" && pkg.RemotePkgRef != "" {
		setIf(desc, "URL", "https://github.com/"+pkg.RemotePkgRef)
		setIf(desc, "BugReports", "https://github.com/"+pkg.RemotePkgRef+"/issues")
	}
	setIf(desc, "URL", pkg.URL)
	setIf(desc, "BugReports", pkg.BugReports)

	// Special mapped config fields
	desc["Config/testthat/edition"] = firstNonEmpty(desc["Config/testthat/edition"], pkg.ConfigTesthat)
	desc["Config/Needs/website"] = firstNonEmpty(desc["Config/Needs/website"], pkg.ConfigNeeds)

	// Arrays: Dependencies are formatted as comma-separated strings because that's
	// the DESCRIPTION file standard format expected by R package management tools.
	setIf(desc, "Imports", strings.Join(pkg.Imports, ", "))
	setIf(desc, "Suggests", strings.Join(pkg.Suggests, ", "))
	if len(pkg.Requirements) > 0 {
		deps := make([]string, 0, len(pkg.Requirements))
		for _, dep := range pkg.Requirements {
			deps = append(deps, string(dep))
		}
		setIf(desc, "Depends", strings.Join(deps, ", "))
	}

	// Repository info from lockfile is preserved for debugging and compatibility
	// with tools that expect to see the original repository reference.
	setIf(desc, "Repository", string(pkg.Repository))
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

// resolveRepoAndSource normalizes repository references to ensure defaultPackageMapper (legacy) and
// LockfilePackageMapper produce equivalent output. This consistency is critical for deployment
// reliability regardless of which approach was used during publish.
func resolveRepoAndSource(
	repoNameByURL map[string]string,
	cranRepoURL string,
	defaultBiocURL string,
	repoStr string,
	src string,
	pkgName string,
) (string, string, error) {
	// Repository placeholder resolution is needed because renv uses shortcuts like
	// "CRAN" that must be resolved to actual URLs for deployment consistency.
	repoURL := strings.TrimRight(repoStr, "/")
	repoName := repoStr

	if repoStr == "CRAN" {
		if cranRepoURL == "" {
			return "", "", fmt.Errorf("CRAN package %s but no CRAN repository listed in renv.lock", pkgName)
		}
		repoURL = cranRepoURL
	}

	// Bioconductor repository defaulting is required because Bioconductor packages
	// may not explicitly specify their repository URL, but we need a resolvable
	// location for deployment to work correctly.
	if repoURL == "" && src == "Bioconductor" {
		if defaultBiocURL == "" {
			return "", "", fmt.Errorf("Bioconductor package %s has no repository and no Bioconductor repositories are listed in renv.lock", pkgName)
		}
		repoURL = defaultBiocURL
		// Look up the name for the default Bioc URL
		if name, found := repoNameByURL[defaultBiocURL]; found {
			repoName = name
		} else {
			repoName = "BioCsoft" // fallback name
		}
	} else if isURL(repoStr) {
		// If we have a URL, look up the corresponding repository name
		repoURL = strings.TrimRight(repoStr, "/")
		if name, found := repoNameByURL[repoURL]; found {
			repoName = name
		} else {
			return "", "", fmt.Errorf("Package %s references repository URL %s which is not listed in renv.lock R.repositories", pkgName, repoURL)
		}
	} else if repoStr != "" {
		// We have a name reference, resolve it to URL for validation
		for url, name := range repoNameByURL {
			if name == repoStr {
				repoURL = url
				repoName = name
				break
			}
		}
		if repoURL == repoStr && !isURL(repoStr) {
			return "", "", fmt.Errorf("Package %s references repository %s which cannot be resolved to a URL", pkgName, repoStr)
		}
	}

	// Validate we can resolve to a URL
	if repoURL == "" {
		return "", "", fmt.Errorf("Package %s has an unresolved repository; cannot generate manifest entry", pkgName)
	}

	// Standardize Bioconductor source label in manifest
	resolvedSource := repoName
	lowerURL := strings.ToLower(repoURL)
	if src == "Bioconductor" || strings.HasPrefix(repoName, "BioC") || strings.Contains(lowerURL, "bioconductor.org/packages/") {
		resolvedSource = "Bioconductor"
	}

	// Always return the repository name (not URL) for consistent output
	return resolvedSource, repoName, nil
}
