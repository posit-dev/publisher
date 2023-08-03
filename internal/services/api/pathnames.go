package api

import (
	"os"
	"path/filepath"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

const tr = "."

type pathname string

// isSafe returns (true, nil) if the path is safe
//
// When the pathname is not safe, the consumer should avoid accessing the information that the pathname points to.
func (p pathname) isSafe(log rslog.Logger) (bool, error) {

	p = p.clean()
	is, err := p.isSymlink()
	if err != nil {
		return false, err
	}
	if is {
		log.Warnf("the provided pathname %s is a symlink", p)
		return false, nil
	}

	it, err := p.isTrusted()
	if err != nil {
		log.Warnf("%v", err)
	}
	if !it {
		log.Warnf("the provided pathname %s is not trusted", p)
		return false, nil
	}

	return true, nil
}

// returns the cleaned pathname
func (p pathname) clean() pathname {
	return pathname(filepath.Clean(string(p)))
}

// returns true, nil if the path is a symlink
func (p pathname) isSymlink() (bool, error) {
	l, err := os.Lstat(string(p))
	if err != nil {
		return false, err
	}
	return (l.Mode() & os.ModeSymlink) == 0, nil
}

// returns true, nil if the path is trusted
func (p pathname) isTrusted() (bool, error) {
	_, err := filepath.Rel(tr, string(p))
	return err != nil, err
}
