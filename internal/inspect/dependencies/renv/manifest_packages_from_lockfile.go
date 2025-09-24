package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/interpreters"
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
	base        util.AbsolutePath
	rExecutable util.Path
	log         logging.Logger
	scanner     RDependencyScanner
}

func NewLockfilePackageMapper(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) *LockfilePackageMapper {
	return &LockfilePackageMapper{
		base:        base,
		rExecutable: rExecutable,
		log:         log,
		scanner:     NewRDependencyScanner(log, nil),
	}
}

// GetManifestPackages implements the PackageMapper interface for LockfilePackageMapper.
// It delegates to GetManifestPackagesFromLockfile, using the mapper's stored base and log.
func (m *LockfilePackageMapper) GetManifestPackages(base util.AbsolutePath, lockfilePath util.AbsolutePath, log logging.Logger) (bundles.PackageMap, error) {
	return m.GetManifestPackagesFromLockfile(lockfilePath)
}

// GetManifestPackagesFromLockfile extracts package information directly from renv.lock
// without requiring installed R packages. This contrasts with defaultPackageMapper.GetManifestPackages
// which reads DESCRIPTION files from installed R libraries. Both approaches must produce
// equivalent manifest output for the same renv.lock to ensure deployment consistency.
func (m *LockfilePackageMapper) GetManifestPackagesFromLockfile(
	lockfilePath util.AbsolutePath) (bundles.PackageMap, error) {

	m.log.Debug("Reading lockfile for package manifest generation", "lockfile", lockfilePath.String())

	lockfile, err := ReadLockfile(lockfilePath)
	if err != nil {
		return nil, err
	}

	m.log.Debug("Processing packages from lockfile", "package_count", len(lockfile.Packages))

	manifestPackages := bundles.PackageMap{}

	// Repository lookups are pre-computed because LockfilePackageMapper must normalize repository
	// references consistently to produce the same output format as defaultPackageMapper.
	// Both approaches handle packages that may reference repositories by name ("CRAN") or URL.
	repoNameToURL := m.findAllRepositories(lockfile)

	// Repository resolution is delegated to resolveRepoAndSource to ensure LockfilePackageMapper
	// and defaultPackageMapper produce identical normalization (URLs converted to repository names).

	for pkgName, pkg := range lockfile.Packages {
		manifestPkg := &bundles.Package{
			Source:     pkg.Source,
			Repository: string(pkg.Repository),
		}

		// Determine the repository identifier from various possible sources
		// Prioritize RemoteRepos over Repository when it exists since it's more specific
		repoIdentifier := firstNonEmpty(pkg.RemoteRepos, string(pkg.Repository))

		if repoIdentifier == "" && pkg.RemoteType != "" {
			// Git-hosted packages (GitHub, GitLab, etc.) need special URL construction
			// because they don't follow standard repository conventions.
			manifestPkg.Source = pkg.RemoteType
			manifestPkg.Repository = remoteRepoURL(pkg.RemoteType, pkg.RemotePkgRef)
		} else if repoIdentifier != "" || pkg.Source == "Bioconductor" {
			// All repository-based packages use the same resolution logic:
			// - CRAN packages with Repository="CRAN"
			// - Custom repository packages with Repository URLs
			// - Bioconductor packages (may not have Repository field, resolved via Source)
			resolvedSource, resolvedRepo, err := resolveRepoAndSource(repoNameToURL, repoIdentifier, pkg.Source)
			if err != nil {
				return nil, err
			}
			manifestPkg.Source = resolvedSource
			manifestPkg.Repository = resolvedRepo
		}

		// DESCRIPTION record construction follows R package conventions because
		// deployment targets expect standard package metadata format.
		manifestPkg.Description = dcf.Record{
			"Package": string(pkgName),
			"Version": pkg.Version,
		}

		manifestPkg.Description["Type"] = "Package"

		// Title fallback ensures every package has a descriptive title
		// when we display information to users.
		// This generates "<Source> R Package" as the title if missing.
		fallbackTitle := strings.TrimSpace(firstNonEmpty(manifestPkg.Source, pkg.Source) + " R package")
		manifestPkg.Description["Title"] = firstNonEmpty(pkg.Title, fallbackTitle)

		// Populate all standard fields from the lockfile package into the DESCRIPTION
		copyAllFieldsToDesc(pkg, manifestPkg)

		// Validate we resolved a usable Source
		if manifestPkg.Source == "" {
			return nil, fmt.Errorf("Package %s has an unresolved source; cannot generate manifest entry", pkgName)
		}
		// Validate we resolved a repository
		if manifestPkg.Repository == "" {
			return nil, fmt.Errorf("Package %s has an unresolved repository; cannot generate manifest entry", pkgName)
		}

		manifestPackages[string(pkgName)] = *manifestPkg
	}

	m.log.Debug("Successfully generated manifest packages from lockfile", "manifest_package_count", len(manifestPackages))
	return manifestPackages, nil
}

// copyAllFieldsToDesc transfers metadata from lockfile packages to what is
// expected by manifest.json via the DCF.
func copyAllFieldsToDesc(pkg Package, manifestPkg *bundles.Package) {
	desc := manifestPkg.Description

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
	setIf(desc, "Repository", manifestPkg.Repository)

	// Special mapped config fields
	desc["Config/testthat/edition"] = firstNonEmpty(desc["Config/testthat/edition"], pkg.ConfigTesthat)
	desc["Config/Needs/website"] = firstNonEmpty(desc["Config/Needs/website"], pkg.ConfigNeeds)

	// Arrays: Dependencies are formatted as comma-separated strings because that's
	// the DESCRIPTION file standard format expected by R package management tools.
	setIf(desc, "Imports", strings.Join(pkg.Imports, ", "))
	setIf(desc, "Suggests", strings.Join(pkg.Suggests, ", "))
	setIf(desc, "LinkingTo", strings.Join(pkg.LinkingTo, ", "))
	// Prefer explicit Depends list if present in the lockfile; otherwise fall back to Requirements
	if len(pkg.Depends) > 0 {
		setIf(desc, "Depends", strings.Join(pkg.Depends, ", "))
	} else if len(pkg.Requirements) > 0 {
		deps := make([]string, 0, len(pkg.Requirements))
		for _, dep := range pkg.Requirements {
			deps = append(deps, string(dep))
		}
		setIf(desc, "Depends", strings.Join(deps, ", "))
	}

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
// LockfilePackageMapper produce equivalent output. This consistency is necessary for deployment
// reliability regardless of which approach was used during publish.
// repoStr can be either the name of the repository or the URL itself.
func resolveRepoAndSource(repoNameToURL map[string]string, repoStr, src string) (string, string, error) {
	repoURL := strings.TrimRight(repoStr, "/")
	repoName := repoStr

	// If repoStr is already a URL, use it directly
	if isURL(repoStr) {
		repoURL = strings.TrimRight(repoStr, "/")
		// Try to find the repository name for this URL
		for name, url := range repoNameToURL {
			if url == repoURL {
				repoName = name
				break
			}
		}
	} else if repoStr != "" {
		// repoStr is a repository name, look up the URL
		if url, found := repoNameToURL[repoStr]; found {
			repoURL = url
			repoName = repoStr
		} else {
			return "", "", fmt.Errorf("repository %s cannot be resolved to a URL", repoStr)
		}
	} else if src == "Bioconductor" {
		// Bioconductor packages may not have Repository field, use BioCsoft as default
		if biocURL, found := repoNameToURL["BioCsoft"]; found {
			repoURL = biocURL
			repoName = "BioCsoft"
		} else {
			return "", "", fmt.Errorf("Bioconductor package source specified but no Bioconductor repositories are available")
		}
	}

	// Validate we could resolve to a Repository URL
	if repoURL == "" {
		return "", "", fmt.Errorf("repository %s could not be resolved to a URL", repoName)
	}

	// Standardize Bioconductor source label in manifest
	resolvedSource := repoName
	lowerURL := strings.ToLower(repoURL)
	if src == "Bioconductor" || strings.HasPrefix(repoName, "BioC") || strings.Contains(lowerURL, "bioconductor.org/packages/") {
		resolvedSource = "Bioconductor"
	}

	// Return repository name as Source and repository URL as Repository
	// This matches the manifest.Package field expectations:
	// - Source should be the repository name (from renv.lock Repository field)
	// - Repository should be the repository URL (from renv.lock Repositories[].URL or RemoteRepos)
	return resolvedSource, repoURL, nil
}

// ScanDependencies uses renv to scan for dependencies and generate a lockfile.
// This works with just an R executable and doesn't require a full R environment setup.
func (m *LockfilePackageMapper) ScanDependencies(paths []string, log logging.Logger) (util.AbsolutePath, error) {
	if m.rExecutable.String() == "" {
		return util.AbsolutePath{}, fmt.Errorf("R executable not available for dependency scanning")
	}

	rInterpreter, err := interpreters.NewRInterpreter(m.base, m.rExecutable, m.log, nil, nil, nil)
	if err != nil {
		log.Warn("Failed to create R interpreter for lockfile mapper", "error", err)
		return util.AbsolutePath{}, err
	}

	// Check if renv package is installed
	if aerr := rInterpreter.IsRenvInstalled(m.rExecutable.String()); aerr != nil {
		return util.AbsolutePath{}, aerr
	}

	// Use the scanner to generate a lockfile
	generatedPath, err := m.scanner.ScanDependencies(paths, m.rExecutable.String())
	if err != nil {
		return util.AbsolutePath{}, err
	}
	return generatedPath, nil
}

// findAllRepositories builds a comprehensive repository map from both the explicit
// R.Repositories section and dynamically discovered repositories from package RemoteRepos fields.
// Returns a map from repository name to URL for easy lookup.
func (m *LockfilePackageMapper) findAllRepositories(lockfile *Lockfile) map[string]string {
	// Initialize with standard repositories as defaults
	repoNameToURL := map[string]string{
		"CRAN": "https://cloud.r-project.org",
		"RSPM": "https://packagemanager.rstudio.com/all/latest",
	}

	// Add Bioconductor repositories default if version is available
	if lockfile.Bioconductor.Version != "" {
		v := lockfile.Bioconductor.Version
		repoNameToURL["BioCsoft"] = "https://bioconductor.org/packages/" + v + "/bioc"
		repoNameToURL["BioCann"] = "https://bioconductor.org/packages/" + v + "/data/annotation"
		repoNameToURL["BioCexp"] = "https://bioconductor.org/packages/" + v + "/data/experiment"
		repoNameToURL["BioCworkflows"] = "https://bioconductor.org/packages/" + v + "/workflows"
		repoNameToURL["BioCbooks"] = "https://bioconductor.org/packages/" + v + "/books"
	}

	// Process explicit repositories from R.Repositories section
	// These will override the standard repositories if they provide different URLs
	for _, r := range lockfile.R.Repositories {
		url := strings.TrimRight(string(r.URL), "/")
		repoNameToURL[r.Name] = url
	}

	// Discover additional repositories from package RemoteRepos fields
	for _, pkg := range lockfile.Packages {
		if pkg.RemoteRepos != "" && pkg.Repository != "" {
			remoteURL := strings.TrimRight(pkg.RemoteRepos, "/")
			repoName := string(pkg.Repository)

			// Simply update the mapping - much simpler with Name→URL
			repoNameToURL[repoName] = remoteURL
			m.log.Debug("Discovered repository from package RemoteRepos",
				"repository", repoName, "url", remoteURL, "package", string(pkg.Package))
		}
	}

	return repoNameToURL
}
