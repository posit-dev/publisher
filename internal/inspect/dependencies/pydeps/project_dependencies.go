package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type DependencyScanner interface {
	ScanDependencies(base util.AbsolutePath, pythonExecutable string) ([]*PackageSpec, error)
}

type defaultDependencyScanner struct {
	mapper  PackageMapper
	scanner ProjectImportScanner
	log     logging.Logger
}

func NewDependencyScanner(log logging.Logger) *defaultDependencyScanner {
	return &defaultDependencyScanner{
		mapper:  NewPackageMapper(log),
		scanner: NewProjectImportScanner(log),
		log:     log,
	}
}

func (s *defaultDependencyScanner) ScanDependencies(base util.AbsolutePath, pythonExecutable string) ([]*PackageSpec, error) {
	importNames, err := s.scanner.ScanProjectImports(base)
	if err != nil {
		return nil, err
	}
	mapping, err := s.mapper.GetPackageMap(pythonExecutable)
	if err != nil {
		return nil, err
	}
	var specs []*PackageSpec
	for _, importName := range importNames {
		spec, ok := mapping[importName]
		if ok {
			specs = append(specs, spec)
		} else {
			// We didn't see this package installed or in our stdlib list.
			// Assume it's installable under its import name.
			specs = append(specs, &PackageSpec{
				Name:    PackageName(importName),
				Version: "",
			})
		}
	}
	return specs, nil
}
