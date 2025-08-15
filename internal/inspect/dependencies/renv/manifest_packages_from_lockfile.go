package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
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

// copyAllFieldsToDesc copies Hash, Remote* and other relevant fields from the lockfile Package
// into the DESCRIPTION record when they are non-empty. Arrays are joined as comma-separated lists
// and some fields are mapped to their DESCRIPTION keys (e.g., AuthorsAtR -> Authors@R).
func copyAllFieldsToDesc(pkg Package, desc dcf.Record) {
	// Helper to set a string field if provided and not already set
	setIf := func(key, val string) {
		if val != "" && desc[key] == "" {
			desc[key] = val
		}
	}

	// Copy Hash and all Remote* string fields via reflection to keep resilient to future additions
	v := reflect.ValueOf(pkg)
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Type.Kind() != reflect.String {
			continue
		}
		name := f.Name
		val := v.Field(i).String()
		if val == "" {
			continue
		}
		if name == "Hash" || strings.HasPrefix(name, "Remote") {
			desc[name] = val
		}
	}

	// Map simple string fields
	setIf("Authors@R", pkg.AuthorsAtR)
	setIf("Description", pkg.Description)
	setIf("License", pkg.License)
	setIf("Maintainer", pkg.Maintainer)
	setIf("VignetteBuilder", pkg.VignetteBuilder)
	setIf("RoxygenNote", pkg.RoxygenNote)
	setIf("Encoding", pkg.Encoding)
	setIf("NeedsCompilation", pkg.NeedsCompilation)
	setIf("Author", pkg.Author)
	setIf("SystemRequirements", pkg.SystemRequirements)

	// URLs: prefer GitHub defaults when applicable, otherwise use values in lockfile
	if pkg.RemoteType == "github" && pkg.RemotePkgRef != "" {
		setIf("URL", "https://github.com/"+pkg.RemotePkgRef)
		setIf("BugReports", "https://github.com/"+pkg.RemotePkgRef+"/issues")
	}
	setIf("URL", pkg.URL)
	setIf("BugReports", pkg.BugReports)

	// Special mapped config fields
	if pkg.ConfigTesthat != "" && desc["Config/testthat/edition"] == "" {
		desc["Config/testthat/edition"] = pkg.ConfigTesthat
	}
	if pkg.ConfigNeeds != "" && desc["Config/Needs/website"] == "" {
		desc["Config/Needs/website"] = pkg.ConfigNeeds
	}

	// Arrays: Imports, Suggests, Depends (from Requirements)
	if len(pkg.Imports) > 0 {
		desc["Imports"] = strings.Join(pkg.Imports, ", ")
	}
	if len(pkg.Suggests) > 0 {
		desc["Suggests"] = strings.Join(pkg.Suggests, ", ")
	}
	if len(pkg.Requirements) > 0 {
		deps := make([]string, 0, len(pkg.Requirements))
		for _, dep := range pkg.Requirements {
			deps = append(deps, string(dep))
		}
		desc["Depends"] = strings.Join(deps, ", ")
	}

	// Repository info
	if string(pkg.Repository) != "" {
		desc["Repository"] = string(pkg.Repository)
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

	// Get all the bioconductor repos if available
	biocRepos := []Repository{}
	if lockfile.Bioconductor.Version != "" {
		bioconductorVersion := lockfile.Bioconductor.Version
		biocRepos = []Repository{
			{Name: "BioCsoft", URL: RepoURL("https://bioconductor.org/packages/" + bioconductorVersion + "/bioc")},
			{Name: "BioCann", URL: RepoURL("https://bioconductor.org/packages/" + bioconductorVersion + "/data/annotation")},
			{Name: "BioCexp", URL: RepoURL("https://bioconductor.org/packages/" + bioconductorVersion + "/data/experiment")},
			{Name: "BioCworkflows", URL: RepoURL("https://bioconductor.org/packages/" + bioconductorVersion + "/workflows")},
			{Name: "BioCbooks", URL: RepoURL("https://bioconductor.org/packages/" + bioconductorVersion + "/books")},
		}
	}

	// Process each package in the lockfile
	for pkgName, pkg := range lockfile.Packages {
		manifestPkg := &bundles.Package{
			Source:     pkg.Source,
			Repository: string(pkg.Repository),
		}

		source := pkg.Source

		if pkg.Repository == "" && pkg.RemoteRepos != "" && pkg.RemoteReposName != "" {
			manifestPkg.Source = pkg.RemoteReposName
			manifestPkg.Repository = pkg.RemoteRepos
		} else if pkg.Repository == "" && pkg.RemoteType != "" {
			// Handle packages installed from remote sources (GitHub, GitLab, etc.)
			manifestPkg.Source = pkg.RemoteType
			switch pkg.RemoteType {
			case "github":
				if pkg.RemotePkgRef != "" {
					manifestPkg.Repository = "https://github.com/" + pkg.RemotePkgRef
				}
			case "gitlab":
				if pkg.RemotePkgRef != "" {
					manifestPkg.Repository = "https://gitlab.com/" + pkg.RemotePkgRef
				}
			case "bitbucket":
				if pkg.RemotePkgRef != "" {
					manifestPkg.Repository = "https://bitbucket.org/" + pkg.RemotePkgRef
				}
			}
		} else if pkg.Repository == "" && pkg.Source == "Bioconductor" {
			// Try to find the appropriate Bioconductor repository URL
			for _, repo := range biocRepos {
				if repo.Name == "BioCsoft" {
					manifestPkg.Repository = string(repo.URL)
					break
				}
			}
		} else if source == "Repository" && pkg.Repository == "CRAN" {
			// For CRAN packages, use the first CRAN repo URL from the lockfile
			manifestPkg.Source = "CRAN"
			for _, repo := range lockfile.R.Repositories {
				manifestPkg.Repository = string(repo.URL)
				break // Just use the first CRAN repo
			}
		}

		// Create description record with the package name, version and other available metadata
		description := dcf.Record{
			"Package": string(pkgName),
			"Version": pkg.Version,
		}

		// Add common fields for R packages
		description["Type"] = "Package"

		// Add title from package if available, otherwise use a default
		if pkg.Title != "" {
			description["Title"] = pkg.Title
		} else if source == "CRAN" || source == "Repository" && pkg.Repository == "CRAN" {
			description["Title"] = "R package from CRAN"
		} else if source == "Bioconductor" {
			description["Title"] = "R package from Bioconductor"
		} else {
			description["Title"] = "R package"
		}

		// Populate all other fields from the lockfile package into the DESCRIPTION
		copyAllFieldsToDesc(pkg, description)

		// Set the description in the manifest package
		manifestPkg.Description = description

		// Add to the package map
		manifestPackages[string(pkgName)] = *manifestPkg
	}

	return manifestPackages, nil
}
