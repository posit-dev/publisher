package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type ProjectImportScanner interface {
	ScanProjectImports(base util.AbsolutePath) ([]ImportName, error)
}

type defaultProjectImportScanner struct {
	scanner ImportScanner
	log     logging.Logger
}

func NewProjectImportScanner(log logging.Logger) *defaultProjectImportScanner {
	return &defaultProjectImportScanner{
		scanner: NewImportScanner(log),
		log:     log,
	}
}

func (s *defaultProjectImportScanner) ScanProjectImports(base util.AbsolutePath) ([]ImportName, error) {
	// Scanning is not currently driven by the configured file list - we scan everything.
	matchList, err := matcher.NewMatchingWalker([]string{"*"}, base, s.log)
	if err != nil {
		return nil, err
	}

	var projectImports []ImportName

	err = matchList.Walk(base, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		code := ""

		switch strings.ToLower(path.Ext()) {
		case ".py":
			contents, err := path.ReadFile()
			if err != nil {
				return err
			}
			code = string(contents)
		case ".ipynb":
			code, err = GetNotebookFileInputs(path)
			if err != nil {
				return err
			}
		case ".qmd":
			code, err = GetQuartoFilePythonCode(path)
			if err != nil {
				return err
			}
		}
		if code != "" {
			fileImports := s.scanner.ScanImports(string(code))
			projectImports = append(projectImports, fileImports...)
			s.log.Info("imports from file", "path", path, "imports", fileImports)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("error scanning project imports: %w", err)
	}
	// Sort and de-dup
	slices.Sort(projectImports)
	projectImports = slices.Compact(projectImports)
	return projectImports, nil
}
