// Copyright (C) 2025 by Posit Software, PBC.

package renv

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/suite"
)

type RepoOptionsFunctionalSuite struct {
	suite.Suite
	base util.AbsolutePath
	log  logging.Logger
}

func TestRepoOptionsFunctionalSuite(t *testing.T) {
	suite.Run(t, new(RepoOptionsFunctionalSuite))
}

func (s *RepoOptionsFunctionalSuite) SetupTest() {
	dir, err := os.MkdirTemp("", "repoopts-scan-*")
	s.Require().NoError(err)
	s.base = util.NewAbsolutePath(dir, nil)
	s.log = logging.New()
}

func (s *RepoOptionsFunctionalSuite) TearDownTest() {
	os.RemoveAll(s.base.String())
}

func (s *RepoOptionsFunctionalSuite) TestScannerRespectsRepoOptions() {
	rInterp, err := interpreters.NewRInterpreter(s.base, util.Path{}, s.log, nil, nil, nil)
	s.Require().NoError(err)

	rExec, err := rInterp.GetRExecutable()
	s.Require().NoError(err)

	// Require renv to be available
	aerr := rInterp.IsRenvInstalled(rExec.String())
	s.Require().Nil(aerr)

	// Use explicit options (posit-ppm) and compute expected URL
	opts := &RepoOptions{RDefaultRepositories: "posit-ppm"}
	expected := RepoURLFromOptions(opts)
	s.Require().NotEmpty(expected)

	scanner := NewRDependencyScanner(s.log, opts)
	lockfileName := "renv.lock"
	_, err = scanner.SetupRenvInDir(s.base.String(), lockfileName, rExec.String())
	s.Require().NoError(err)

	lockPath := util.NewAbsolutePath(filepath.Join(s.base.String(), lockfileName), s.base.Fs())
	lf, err := ReadLockfile(lockPath)
	s.Require().NoError(err)

	found := false
	for _, r := range lf.R.Repositories {
		if string(r.URL) == expected {
			found = true
			break
		}
	}
	s.True(found)
}
