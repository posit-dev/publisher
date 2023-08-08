package pathnames

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type Pathname struct {
	path util.Path
	afs  afero.Fs
	log rslog.Logger
}

// Create returns a new instance of Pathname
func Create(s string, afs afero.Fs, log rslog.Logger) Pathname {
	p := util.NewPath(s, afs)
	p = p.Clean()
	return Pathname{p, afs, log}
}

func (p Pathname) String() string {
	return p.path.String()
}

// isSafe returns (true, nil) if the path is safe
//
// When the pathname is not safe, the consumer should avoid accessing the information that the pathname points to.
func (p Pathname) IsSafe() (bool, error) {

	s, err := p.isSymlink()
	if err != nil {
		p.log.Errorf("failure when checking symlink: %v", err)
		return false, err
	}
	if s {
		p.log.Warnf("the provided pathname '%s' is a symlink", p)
		return false, nil
	}

	t, err := p.isTrusted()
	if err != nil {
		p.log.Errorf("failure when checking trust: %v", err)
		return false, err
	}
	if !t {
		p.log.Warnf("the provided pathname '%s' is not trusted", p)
		return false, nil
	}

	return true, nil
}

// isSymlink returns (true, nil) if the path is a symlink
func (p Pathname) isSymlink() (bool, error) {
	l, ok, err := p.path.LstatIfPossible()
	if err != nil {
		// if an error occurs and lstat is called, check if the error op is lstat
		if ok {
			perr, ok := err.(*os.PathError)
			// if cast is ok and err op is lstat, return (false, nil) since it is not a symlink
			if ok && perr.Op == "lstat" {
				return false, nil
			}
		}
		// otherwise, return (false, err) if lstat was not called.
		return false, err
	}
	return (l.Mode() & os.ModeSymlink) != 0, nil
}

// isTrusted returns true, nil if the path is trusted
func (p Pathname) isTrusted() (bool, error) {
	root := util.NewPath(".", p.afs) // todo - replace this with the target directory
	_, err := p.path.Rel(root)
	if err != nil {
		p.log.Warnf("%v")
		return false, nil
	}

	aroot, err := root.Abs()
	if err != nil {
		p.log.Warnf("%v")
		return false, nil
	}

	apath, err := p.path.Abs()
	if err != nil {
		p.log.Warnf("%v")
		return false, nil
	}

	return strings.HasPrefix(apath.String(), aroot.String()), nil
}
