// Copyright (C) 2024 by Posit Software, PBC.

package publish

import (
	"fmt"
	"io"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/inspect/detectors"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type getRPackageDescriptionsStartData struct{}
type getRPackageDescriptionsSuccessData struct{}

type lockfileErrDetails struct {
	Lockfile string
}

func (p *defaultPublisher) getRPackages(scanDependencies bool) (bundles.PackageMap, error) {
	pkgs, _, err := p.getRPackagesWithPath(scanDependencies)
	return pkgs, err
}

// As done in rsconnect. Return a list of extra dependencies that should be included in the bundle
// for content types that sometimes do not include direct calls to dependency packages
// in user code (e.g. shiny apps that do not explicitly call library("shiny")).
func (p *defaultPublisher) findExtraDependencies() []string {
	p.log.Debug("Looking up for extra dependencies for content", "type", p.Config.Type)

	extraDeps := []string{}
	switch p.Config.Type {
	case contenttypes.ContentTypeRMarkdownShiny,
		contenttypes.ContentTypeQuartoShiny:
		extraDeps = append(extraDeps, "shiny", "rmarkdown")
	case contenttypes.ContentTypeQuarto,
		contenttypes.ContentTypeQuartoDeprecated,
		contenttypes.ContentTypeRMarkdown:
		extraDeps = append(extraDeps, "rmarkdown")
		if p.Config.HasParameters != nil && *p.Config.HasParameters {
			extraDeps = append(extraDeps, "shiny")
		}
	case contenttypes.ContentTypeRShiny:
		extraDeps = append(extraDeps, "shiny")
	}

	if p.Config.Type == contenttypes.ContentTypeRPlumber {
		p.log.Debug("Looking up metadata for Plumber content", "project_dir", p.State.Dir.String())

		serverFileChecker := detectors.NewPlumberServerFileChecker(p.log, p.State.Dir)
		serverFile, metadata := serverFileChecker.Find()
		if metadata != nil {
			p.log.Debug("Found Plumber content metadata", "engine", metadata.Engine, "server_file", serverFile)
			extraDeps = append(extraDeps, metadata.Engine)
		}
	}

	return extraDeps
}

// Inject temporary __publisher_deps.R with dependencies not discoverable by renv in common workflows.
func (p *defaultPublisher) recordExtraDependencies() (*util.AbsolutePath, error) {
	extraDeps := p.findExtraDependencies()
	if len(extraDeps) == 0 {
		p.log.Debug("No extra dependencies found to be included")
		return nil, nil
	}

	// Create the file __publisher_deps.R under .posit dir
	// so it does not make the files tree list to jump or blink while deploying.
	depsPath := p.State.Dir.Join(".posit", "__publisher_deps.R")
	depsFile, err := depsPath.Create()
	if err != nil {
		return nil, err
	}
	p.log.Debug("Recording extra dependencies file", "file", depsPath.String(), "dependencies", extraDeps)
	defer depsFile.Close()

	for _, dep := range extraDeps {
		if _, err := depsFile.WriteString(fmt.Sprintf(`library("%s")`+"\n", dep)); err != nil {
			return nil, err
		}
	}

	return &depsPath, nil
}

// getRPackagesWithPath returns packages and the absolute lockfile path used.
func (p *defaultPublisher) getRPackagesWithPath(scanDependencies bool) (bundles.PackageMap, util.AbsolutePath, error) {
	op := events.PublishGetRPackageDescriptionsOp
	log := p.log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, getRPackageDescriptionsStartData{}))
	log.Info("Collecting R package descriptions")

	var lockfilePath util.AbsolutePath
	var lockfileString string
	if scanDependencies {
		log.Info("Detect dependencies from project")
		var scanPaths []string
		if p.Config != nil && len(p.Config.Files) > 0 {
			scanPaths = make([]string, 0, len(p.Config.Files))
			for _, f := range p.Config.Files {
				scanPaths = append(scanPaths, p.Dir.Join(f).String())
			}
		} else {
			// No files were selected, in this case we mimic NewBundler
			// which implies the project directory itself.
			scanPaths = []string{p.Dir.String()}
		}

		extraDepsPath, err := p.recordExtraDependencies()
		if err != nil {
			log.Error("Could not record extra dependencies file", "error", err.Error())
		}
		if extraDepsPath != nil {
			log.Debug("Including extra dependencies file for scanning", "file", extraDepsPath.String())
			scanPaths = append(scanPaths, extraDepsPath.String())
			defer extraDepsPath.Remove()
		}

		// Ask the mapper to scan dependencies and return a generated lockfile
		generated, err := p.rPackageMapper.ScanDependencies(scanPaths, log)
		if err != nil {
			// If error is already an agent error, return as-is
			if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
				return nil, util.AbsolutePath{}, aerr
			}
			agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: p.Dir.String()})
			agentErr.Message = fmt.Sprintf("Could not scan R packages from project: %s", err.Error())
			return nil, util.AbsolutePath{}, agentErr
		}
		lockfilePath = generated
		lockfileString = generated.String()
	} else {
		lockfileString = p.Config.R.PackageFile
		lockfilePath = p.Dir.Join(lockfileString)
		if ok, err := lockfilePath.Exists(); err != nil || !ok {
			agentErr := types.NewAgentError(
				types.ErrorRenvLockPackagesReading,
				fmt.Errorf("configured lockfile %s doesn't exist", lockfileString),
				lockfileErrDetails{Lockfile: lockfileString},
			)
			agentErr.Message = fmt.Sprintf("configured lockfile %q doesn't exist", lockfileString)
			return nil, util.AbsolutePath{}, agentErr
		}
	}

	// Detect mapper type to decide which message to emit
	if _, isLock := p.rPackageMapper.(*renv.LockfilePackageMapper); isLock {
		log.Info("Loading packages from renv.lock", "lockfile", lockfilePath.String())
	} else {
		log.Info("Loading packages from local R library")
	}
	log.Debug("Collecting manifest R packages", "lockfile", lockfilePath)

	rPackages, err := p.rPackageMapper.GetManifestPackages(p.Dir, lockfilePath, log)
	if err != nil {
		// If error is an already well detailed agent error, pass it along
		if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
			return nil, util.AbsolutePath{}, aerr
		}
		agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: lockfilePath.String()})
		agentErr.Message = fmt.Sprintf("Could not scan R packages from lockfile: %s, %s", lockfileString, err.Error())
		return nil, util.AbsolutePath{}, agentErr
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))

	return rPackages, lockfilePath, nil
}

// copyLockfileToPositDir copies a lockfile into .posit/publish/deployments within the
// project directory. Returns the path relative to the project root.
func (p *defaultPublisher) copyLockfileToPositDir(lockfilePath util.Path, log logging.Logger) (util.RelativePath, error) {
	// Ensure destination directory exists
	targetDir := p.Dir.Join(".posit", "publish", "deployments")
	if err := targetDir.MkdirAll(0777); err != nil {
		return util.RelativePath{}, err
	}

	src, err := lockfilePath.Open()
	if err != nil {
		return util.RelativePath{}, err
	}
	defer src.Close()

	// Always stage as renv.lock regardless of source filename (future: add hash naming)
	targetPath := targetDir.Join("renv.lock")
	dst, err := targetPath.Create()
	if err != nil {
		return util.RelativePath{}, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return util.RelativePath{}, err
	}

	rel, err := targetPath.Rel(p.Dir)
	if err != nil {
		return util.RelativePath{}, err
	}
	return rel, nil
}
