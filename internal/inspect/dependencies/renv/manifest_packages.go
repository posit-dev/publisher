package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
)

type PackageMapper interface {
	GetManifestPackages(base util.AbsolutePath, lockfilePath util.AbsolutePath, log logging.Logger) (bundles.PackageMap, error)
}

type rInterpreterFactory = func() (interpreters.RInterpreter, error)

type defaultPackageMapper struct {
	rInterpreterFactory rInterpreterFactory
	rExecutable         util.Path
	lister              AvailablePackagesLister
}

func NewPackageMapper(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) (PackageMapper, error) {
	lister, err := NewAvailablePackageLister(base, rExecutable, log, nil, nil)

	return &defaultPackageMapper{
		rInterpreterFactory: func() (interpreters.RInterpreter, error) {
			return interpreters.NewRInterpreter(base, rExecutable, log, nil, nil, nil)
		},
		rExecutable: rExecutable,
		lister:      lister,
	}, err
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
		return c < '0' || c > '9'
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

func findRepoNameByURL(repoUrl RepoURL, repos []Repository) string {
	for _, repo := range repos {
		if repo.URL == repoUrl {
			return repo.Name
		}
	}
	return ""
}

// normalizeRepositoryToName ensures consistent output between defaultPackageMapper and LockfilePackageMapper.
// The defaultPackageMapper uses installed R libraries while LockfilePackageMapper reads renv.lock directly,
// but both must use repository names (not URLs) to produce equivalent manifests regardless of input format.
func normalizeRepositoryToName(repoStr string, repos []Repository) string {
	// Repository name validation ensures we only return valid names that exist
	// in the lockfile's repository section, preventing invalid references.
	if !isURL(repoStr) {
		for _, repo := range repos {
			if repo.Name == repoStr {
				return repoStr // Valid repository name
			}
		}
		return repoStr // Return as-is if not found (could be special case like "CRAN")
	}

	// URL-to-name resolution is required because packages may reference repositories
	// by URL, but we need consistent name-based references in the final manifest.
	return findRepoNameByURL(RepoURL(repoStr), repos)
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
	// rsconnect compatibility requires following the same package normalization
	// logic to ensure deployments work consistently with existing rsconnect workflows.
	out := &bundles.Package{
		Source:     pkg.Source,
		Repository: normalizeRepositoryToName(string(pkg.Repository), repos),
	}
	source := pkg.Source

	if pkg.Repository == "" && strings.Contains(pkg.RemoteRepos, "bioconductor.org") {
		// renv bug workaround: https://github.com/rstudio/renv/issues/1202
		// renv sometimes fails to set Repository field for Bioconductor packages
		source = "Bioconductor"
	}

	switch source {
	case "Repository":
		if pkg.Repository == "CRAN" {
			if isDevVersion(pkg, availablePackages) {
				// Dev versions from CRAN cannot be reliably deployed because they're
				// newer than what's available in repositories, so we clear Source/Repository
				// to trigger an error that guides users to publish stable versions.
				out.Source = ""
				out.Repository = ""
			} else {
				out.Source = "CRAN"
				// Repository normalization ensures defaultPackageMapper output matches LockfilePackageMapper
				// by always using repository names rather than URLs.
				repoUrl := findRepoUrl(pkg.Package, availablePackages)
				out.Repository = normalizeRepositoryToName(repoUrl, repos)
				if out.Repository == "" {
					out.Repository = "CRAN" // fallback to name
				}
			}
		} else {
			// Non-CRAN repositories require lookup from available packages because
			// the Repository field in DESCRIPTION files is set by the repository
			// and may contain arbitrary values that need validation.
			repoUrl := findRepoUrl(pkg.Package, availablePackages)
			out.Repository = normalizeRepositoryToName(repoUrl, repos)
			out.Source = findRepoNameByURL(RepoURL(repoUrl), repos)

			// Fallback to lockfile repository info is needed when available packages
			// lookup fails, ensuring defaultPackageMapper produces equivalent output to LockfilePackageMapper
			// even when packages aren't available in the current R environment.
			if out.Source == "" && out.Repository == "" && pkg.Repository != "" {
				out.Repository = normalizeRepositoryToName(string(pkg.Repository), repos)
				out.Source = findRepoNameByURL(pkg.Repository, repos)
			}

			// Dev version detection for non-CRAN repositories ensures consistency
			// with CRAN behavior by preventing deployment of packages newer than
			// what's available in their source repositories.
			if strings.EqualFold(out.Source, "CRAN") && isDevVersion(pkg, availablePackages) {
				out.Source = ""
				out.Repository = ""
			}
		}
	case "Bioconductor":
		// Bioconductor package resolution requires checking both standard and
		// Bioconductor-specific package lists because BioC packages may not
		// be available in default CRAN mirrors.
		repoUrl := findRepoUrl(pkg.Package, availablePackages)
		if repoUrl == "" {
			// Try packages defined from default bioC repos
			repoUrl = findRepoUrl(pkg.Package, biocPackages)
		}
		out.Repository = normalizeRepositoryToName(repoUrl, repos)
		// BioCsoft fallback ensures defaultPackageMapper compatibility with LockfilePackageMapper behavior
		// when repository resolution fails but we know it's a Bioconductor package.
		if out.Repository == "" {
			out.Repository = "BioCsoft"
		}
	case "Bitbucket", "GitHub", "GitLab":
		// Git-based sources use lowercase names for consistency.
		out.Source = strings.ToLower(pkg.Source)
	case "Local", "unknown":
		// Local and unknown sources cannot be deployed because they lack
		// reproducible installation sources, so we clear them to trigger errors.
		out.Source = ""
		out.Repository = ""
	}
	return out
}

var errBadDescription = errors.New("invalid DESCRIPTION file")
var errPackageNotFound = errors.New("package not found in current libPaths; consider running renv::restore() to populate the renv library")

var keepWhiteFields = []string{"Description", "Authors@R", "Author", "Built", "Packaged"}

func readPackageDescription(name PackageName, libPaths []util.AbsolutePath) (dcf.Record, error) {
	reader := dcf.NewFileReader(keepWhiteFields)
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
		if len(descRecords) == 0 {
			return nil, fmt.Errorf("%s: %w", descPath.String(), errBadDescription)
		}
		return descRecords[0], nil
	}
	return nil, fmt.Errorf("%s: %w", name, errPackageNotFound)
}

var lockfileLibraryMismatchMsg = "package %s: versions in lockfile '%s' and library '%s' are out of sync. Use renv::restore() or renv::snapshot() to synchronize"
var errMissingPackageSourceMsg = "cannot re-install packages installed from source; all packages must be installed from a reproducible location such as a repository. Package %s, Version %s"

type renvReadErrDetails struct {
	Lockfile        string
	Package         PackageName
	LockfileVersion string
	LibraryVersion  string
}

func mkRenvReadErrDetails(lockfile string, pkg PackageName, lockVersion, libVersion string) renvReadErrDetails {
	return renvReadErrDetails{
		Lockfile:        lockfile,
		Package:         pkg,
		LockfileVersion: lockVersion,
		LibraryVersion:  libVersion,
	}
}

func (m *defaultPackageMapper) GetManifestPackages(
	base util.AbsolutePath,
	lockfilePath util.AbsolutePath,
	log logging.Logger) (bundles.PackageMap, error) {

	lockfile, err := ReadLockfile(lockfilePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, m.renvEnvironmentCheck(log)
		}
		return nil, err
	}

	libPaths, err := m.lister.GetLibPaths(log)
	if err != nil {
		return nil, err
	}

	repos := lockfile.R.Repositories
	available, err := m.lister.ListAvailablePackages(repos, log)
	if err != nil {
		return nil, err
	}

	biocRepos, err := m.lister.GetBioconductorRepos(base, log)
	if err != nil {
		return nil, err
	}

	biocPackages := []AvailablePackage{}
	if len(biocRepos) > 0 {
		biocPackages, err = m.lister.ListAvailablePackages(biocRepos, log)
		if err != nil {
			return nil, err
		}
	}

	manifestPackages := bundles.PackageMap{}
	names := []PackageName{}
	for _, pkg := range lockfile.Packages {
		names = append(names, pkg.Package)
	}
	slices.Sort(names)
	for _, pkgName := range names {
		pkg := lockfile.Packages[pkgName]

		manifestPkg := toManifestPackage(&pkg, repos, available, biocPackages)
		description, err := readPackageDescription(pkg.Package, libPaths)
		if err != nil {
			return nil, err
		}
		renvErrDetails := mkRenvReadErrDetails(lockfilePath.String(), pkg.Package, pkg.Version, description["Version"])
		if description["Version"] != pkg.Version {
			agentErr := types.NewAgentError(
				types.ErrorRenvPackageVersionMismatch,
				fmt.Errorf(lockfileLibraryMismatchMsg, pkg.Package, pkg.Version, description["Version"]),
				renvErrDetails)
			return nil, agentErr
		}
		if manifestPkg.Source == "" {
			agentErr := types.NewAgentError(
				types.ErrorRenvPackageSourceMissing,
				fmt.Errorf(errMissingPackageSourceMsg, pkg.Package, pkg.Version),
				renvErrDetails)
			return nil, agentErr
		}
		manifestPkg.Description = description
		manifestPackages[string(pkg.Package)] = *manifestPkg
	}
	return manifestPackages, nil
}

func (m *defaultPackageMapper) renvEnvironmentCheck(
	log logging.Logger,
) *types.AgentError {
	rInterpreter, err := m.rInterpreterFactory()
	if err != nil {
		log.Error("R interpreter failed to be instantiated while verifying renv environment", "error", err.Error())
		verifyErr := types.NewAgentError(types.ErrorUnknown, err, nil)
		verifyErr.Message = "Unable to determine if renv is installed"
		return verifyErr
	}

	return rInterpreter.RenvEnvironmentErrorCheck()
}
