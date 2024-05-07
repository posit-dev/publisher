package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"regexp"
	"slices"
	"strings"

	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/spf13/afero"
)

type PackageName string

type PackageSpec struct {
	Name    PackageName
	Version string
}

func (s *PackageSpec) String() string {
	if s.Version != "" {
		return fmt.Sprintf("%s==%s", s.Name, s.Version)
	} else {
		return string(s.Name)
	}
}

type PackageMap map[ImportName]*PackageSpec

type PackageMapper interface {
	GetPackageMap(pythonExecutable string) (PackageMap, error)
}

type defaultPackageMapper struct {
	executor executor.Executor
	fs       afero.Fs
	log      logging.Logger
}

func NewPackageMapper(log logging.Logger) *defaultPackageMapper {
	return &defaultPackageMapper{
		executor: executor.NewExecutor(),
		fs:       nil,
		log:      log,
	}
}

var distInfoRE = regexp.MustCompile("(.*)-(.*).dist-info")

func packageSpecFromDirName(infoDir util.Path) *PackageSpec {
	m := distInfoRE.FindStringSubmatch(infoDir.Base())
	if len(m) < 2 {
		// Not a dist-info directory
		return nil
	}
	return &PackageSpec{
		Name:    PackageName(m[1]),
		Version: m[2],
	}
}

func (m *defaultPackageMapper) getLibDirs(pythonExecutable string) ([]util.Path, error) {
	code := "import sys; [print(p) for p in sys.path]"
	out, _, err := m.executor.RunCommand(pythonExecutable, []string{"-c", code}, m.log)
	if err != nil {
		return nil, err
	}
	rawPaths := strings.Split(string(out), "\n")
	paths := make([]util.Path, 0, len(rawPaths))
	for _, path := range rawPaths {
		trimmed := strings.TrimSpace(path)
		paths = append(paths, util.NewPath(trimmed, m.fs))
	}
	return paths, nil
}

func (m *defaultPackageMapper) getMappingForLibDir(libDir util.Path) (PackageMap, error) {
	mapping := PackageMap{}

	infoDirs, err := libDir.Glob("*.dist-info")
	if err != nil {
		return nil, err
	}
	for _, infoDir := range infoDirs {
		spec := packageSpecFromDirName(infoDir)
		packageListStr, err := infoDir.Join("top_level.txt").ReadFile()
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				// No top-level.txt, so import name == package name
				importName := ImportName(spec.Name)
				mapping[importName] = spec
				continue
			} else {
				return nil, err
			}
		}
		// Import names are listed in top_level.txt
		importNames := strings.Split(string(packageListStr), "\n")
		for _, name := range importNames {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			mapping[ImportName(name)] = spec
		}
	}
	return mapping, nil
}

func (m *defaultPackageMapper) GetPackageMap(pythonExecutable string) (PackageMap, error) {
	mapping := PackageMap{}
	libDirs, err := m.getLibDirs(pythonExecutable)
	if err != nil {
		return nil, err
	}
	// Process dirs in reverse order, so that earlier ones override later ones
	// (the same precedence as the Python import order)
	slices.Reverse(libDirs)

	for _, libDir := range libDirs {
		if libDir.HasSuffix(".zip") || libDir.String() == "" {
			continue
		}
		dirMapping, err := m.getMappingForLibDir(libDir)
		if err != nil {
			return nil, fmt.Errorf("error finding installed packages: %w", err)
		}
		maps.Copy(mapping, dirMapping)
	}
	return mapping, nil
}
