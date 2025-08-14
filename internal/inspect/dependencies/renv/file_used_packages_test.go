package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type FileUsedPackagesSuite struct {
	utiltest.Suite
}

func TestFileUsedPackagesSuite(t *testing.T) {
	suite.Run(t, new(FileUsedPackagesSuite))
}

func (s *FileUsedPackagesSuite) TestNewUsedPackagesScanner() {
	log := logging.New()
	scanner := NewUsedPackagesScanner(log)
	s.Equal(log, scanner.log)
}

func (s *FileUsedPackagesSuite) TestScanUsedPackages() {
	code := `
		library(foo)
		library(bar); library("baz")
		package(foobar)
		# stdlib
		library(utils)
		# namespace references
		foobar::dofoo
		foobar:::wontfoo
		frobble::woo
		fribble.zaz::wii
	`
	log := logging.New()
	scanner := NewUsedPackagesScanner(log)
	usedPackages := scanner.ScanUsedPackages(code)
	s.Equal([]UsedPackageName{
		"bar",
		"baz",
		"foo",
		"foobar",
		"fribble.zaz",
		"frobble",
	}, usedPackages)
}

func (s *FileUsedPackagesSuite) TestScanUsedPackagesUnicode() {
	code := `
		library(çde)
		library(Щ); library(Σ123)
		Θ::woo
	`
	log := logging.New()
	scanner := NewUsedPackagesScanner(log)
	usedPackages := scanner.ScanUsedPackages(code)
	s.Equal([]UsedPackageName{
		"çde", "Θ", "Σ123", "Щ",
	}, usedPackages)
}
