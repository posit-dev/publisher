package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/logging"
)

type UsedPackageName string

type UsedPackagesScanner interface {
	ScanUsedPackages(code string) []UsedPackageName
}

type defaultUsedPackagesScanner struct {
	log logging.Logger
}

func NewUsedPackagesScanner(log logging.Logger) *defaultUsedPackagesScanner {
	return &defaultUsedPackagesScanner{
		log: log,
	}
}

// R identifiers for package names: allow unicode letters, digits, underscore and dot, must start with a letter.
// Note: This is slightly permissive but practical for R package names.
var rPkgBody = `[\p{L}][\p{L}\p{N}_\.]*`

// Matches library(pkg) or library("pkg") and package(pkg) or package("pkg") anywhere in a line.
// Captures package name in a single group, optionally surrounded by single or double quotes.
// Note: This allows mismatched quotes around the name (e.g., 'foo") but package names don't include quotes, so it's acceptable.
var libOrPackageCallRE = regexp.MustCompile(`(?:^|[^\w])(?:library|package)\s*\(\s*['"]?(` + rPkgBody + `)['"]?`) // nolint: gosimple

// Matches X::foo or X:::foo anywhere in the line and captures X in group 1.
// Avoid ASCII word boundary to support Unicode package names.
var nsRefRE = regexp.MustCompile(`(` + rPkgBody + `):::{0,2}`)

func (s *defaultUsedPackagesScanner) ScanUsedPackages(code string) []UsedPackageName {
	used := []UsedPackageName(nil)

	lines := strings.Split(code, "\n")
	for _, line := range lines {
		// library()/package() calls
		if ms := libOrPackageCallRE.FindAllStringSubmatch(line, -1); len(ms) > 0 {
			for _, m := range ms {
				name := ""
				if len(m) >= 2 {
					name = m[1]
				}
				name = strings.TrimSpace(name)
				if name != "" {
					used = append(used, UsedPackageName(name))
				}
			}
		}
		// X::foo or X:::foo
		if ms := nsRefRE.FindAllStringSubmatch(line, -1); len(ms) > 0 {
			for _, m := range ms {
				if len(m) >= 2 {
					name := strings.TrimSpace(m[1])
					if name != "" {
						used = append(used, UsedPackageName(name))
					}
				}
			}
		}
	}
	// Remove std library import names
	used = slices.DeleteFunc(used, func(name UsedPackageName) bool {
		return name == "" || slices.Contains(stdLibUsedPackages, name)
	})
	// Deduplicate
	// works because we sorted, thus duplicates are adjacent
	slices.Sort(used)
	used = slices.Compact(used)
	return used
}

// Base R packages that should not be reported as dependencies.
var stdLibUsedPackages = []UsedPackageName{
	"base",
	"compiler",
	"datasets",
	"graphics",
	"grDevices",
	"grid",
	"methods",
	"parallel",
	"splines",
	"stats",
	"stats4",
	"tcltk",
	"tools",
	"translations",
	"utils",
}
