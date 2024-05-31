package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/logging"
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

// https://docs.python.org/3/reference/lexical_analysis.html#identifiers
const idStart = `(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|_)`

var idContinue = fmt.Sprintf(`(%s|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc})`, idStart)
var identifier = fmt.Sprintf("%s(%s*)", idStart, idContinue)

// https://docs.python.org/3/reference/simple_stmts.html#the-import-statement
var module = fmt.Sprintf(`(%s\.)*%s`, identifier, identifier)

var importRE = regexp.MustCompile(
	fmt.Sprintf(`^\s*import (%s(\s*,\s*%s)*)`, module, module))

var importFromRE = regexp.MustCompile(fmt.Sprintf(`^\s*from (%s) import`, module))

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
