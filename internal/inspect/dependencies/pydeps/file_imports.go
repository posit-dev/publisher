package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"
	"slices"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
)

type ImportName string

type ImportScanner interface {
	ScanImports(code string) []ImportName
}

type defaultImportScanner struct {
	log logging.Logger
}

func NewImportScanner(log logging.Logger) *defaultImportScanner {
	return &defaultImportScanner{
		log: log,
	}
}

const idExpr = "[A-Za-z_.]+"

var importRE = regexp.MustCompile(
	strings.ReplaceAll(
		`^\s*import (id(\s*,\s*id)*)`,
		"id", idExpr,
	))

var importFromRE = regexp.MustCompile(
	strings.ReplaceAll(
		`^\s*from (id) import`,
		"id", idExpr,
	))

func importNameFromModule(module string) ImportName {
	module = strings.TrimSpace(module)
	baseName := strings.Split(module, ".")[0]
	return ImportName(baseName)
}

func (s *defaultImportScanner) ScanImports(code string) []ImportName {
	importNames := []ImportName(nil)

	lines := strings.Split(code, "\n")
	for _, line := range lines {
		m := importRE.FindStringSubmatch(line)
		if len(m) >= 1 {
			// Split the comma-separate list of modules
			moduleListStr := m[1]
			moduleList := strings.Split(moduleListStr, ",")
			for _, module := range moduleList {
				importNames = append(importNames, importNameFromModule(module))
			}
		}
		m = importFromRE.FindStringSubmatch(line)
		if len(m) >= 1 {
			importNames = append(importNames, importNameFromModule(m[1]))
		}
	}
	// Remove std library import names
	importNames = slices.DeleteFunc(importNames, func(name ImportName) bool {
		return name == "" || slices.Contains(stdLibImports, name)
	})
	// Sort and de-dup
	slices.Sort(importNames)
	importNames = slices.Compact(importNames)
	return importNames
}
