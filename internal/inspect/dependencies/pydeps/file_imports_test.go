package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type FileImportsSuite struct {
	utiltest.Suite
}

func TestFileImportsSuite(t *testing.T) {
	suite.Run(t, new(FileImportsSuite))
}

func (s *FileImportsSuite) TestNewImportScanner() {
	log := logging.New()
	scanner := NewImportScanner(log)
	s.Equal(log, scanner.log)
}

func (s *FileImportsSuite) TestScanImports() {
	code := `
		import foo
		import bar, baz
		import foobar.dofoo as dontfoo
		import foobar.wontfoo as cantfoo

		from frobble import woo as wow
		from fribble.zaz import wii
		from . import kazaam
		from .. import shazaam
	`
	log := logging.New()
	scanner := NewImportScanner(log)
	importNames := scanner.ScanImports(code)
	s.Equal([]ImportName{
		"bar",
		"baz",
		"foo",
		"foobar",
		"fribble",
		"frobble",
	}, importNames)
}

func (s *FileImportsSuite) TestScanImportsUnicode() {
	code := `
		import çde
		import Щ, Σ123
		from Θ import woo as wow
	`
	log := logging.New()
	scanner := NewImportScanner(log)
	importNames := scanner.ScanImports(code)
	s.Equal([]ImportName{
		"çde", "Θ", "Σ123", "Щ",
	}, importNames)
}
