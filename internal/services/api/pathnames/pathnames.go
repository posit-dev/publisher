package pathnames

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
)

type Pathname struct {
	v string
	afs afero.Fs
}

// Create returns a new instance of Pathname
func Create(s string, afs afero.Fs) Pathname {
	return Pathname{s, afs}
}

// isSafe returns (true, nil) if the path is safe
//
// When the pathname is not safe, the consumer should avoid accessing the information that the pathname points to.
func (p Pathname) IsSafe() (bool, error) {

	p = p.clean()
	s, err := p.isSymlink()
	if err != nil {
		return false, err
	}
	if s {
		return false, fmt.Errorf("the provided pathname '%s' is a symlink", p)
	}

	t, err := p.isTrusted()
	if err != nil {
		return false, err
	}
	if !t {
		return false, fmt.Errorf("the provided pathname '%s' is not trusted", p)
	}

	return true, nil
}

// clean returns the cleaned pathname
func (p Pathname) clean() Pathname {
	return Create(filepath.Clean(p.v), p.afs)
}

// isSymlink returns true, nil if the path is a symlink
func (p Pathname) isSymlink() (bool, error) {
	_, err := os.Stat(p.v)
	if err != nil {
		op := err.(*fs.PathError).Op
		switch op {
		case "stat":
			return false, nil
		case "lstat":
			// skip
		default:
			return false, err
		}
	}

	l, err := os.Lstat(p.v)
	if err != nil {
		return false, err
	}
	return (l.Mode() & os.ModeSymlink) != 0, nil
}

// isTrusted returns true, nil if the path is trusted
func (p Pathname) isTrusted() (bool, error) {
	tr := "."
	_, err := filepath.Rel(tr, p.v)
	if err != nil {
		return false, err
	}

	tra, err := filepath.Abs(tr)
	if err != nil {
		return false, err
	}

	va, err := filepath.Abs(p.v)
	if err != nil {
		return false, err
	}

	return strings.HasPrefix(va, tra), nil
}
