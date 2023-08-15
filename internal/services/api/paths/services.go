package paths

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type IPathsService interface {
	IsSafe(p util.Path) (bool, error)
}

func CreatePathsService(base util.Path, afs afero.Fs, log rslog.Logger) IPathsService {
	return PathsService{base, afs, log}
}

type PathsService struct {
	base util.Path
	afs  afero.Fs
	log  rslog.Logger
}

func (s PathsService) IsSafe(p util.Path) (bool, error) {
	symlink, err := s.isSymlink(p)
	if err != nil {
		s.log.Errorf("failure when checking symlink: %v", err)
		return false, err
	}
	if symlink {
		s.log.Warnf("the provided pathname '%s' is a symlink", p)
		return false, nil
	}

	trusted, err := s.isTrusted(p)
	if err != nil {
		s.log.Errorf("failure when checking trust: %v", err)
		return false, err
	}
	if !trusted {
		s.log.Warnf("the provided pathname '%s' is not trusted", p)
		return false, nil
	}

	return true, nil
}

func (s PathsService) isSymlink(p util.Path) (bool, error) {
	l, ok, err := p.LstatIfPossible()
	if err != nil {
		// if an error occurs and lstat is called, check if the error op is lstat
		if ok {
			perr, pok := err.(*os.PathError)
			// if cast is ok and err op is lstat, return (false, nil) since it is not a symlink
			if pok && perr.Op == "lstat" {
				return false, nil
			}
		}
		// otherwise, return (false, err) if lstat was not called.
		return false, err
	}
	return (l.Mode() & os.ModeSymlink) != 0, nil

}

func (s PathsService) isTrusted(p util.Path) (bool, error) {
	_, err := p.Rel(s.base)
	if err != nil {
		s.log.Warnf("%v", err)
		return false, nil
	}

	absbase, err := s.base.Abs()
	if err != nil {
		s.log.Warnf("%v", err)
		return false, nil
	}

	abspath, err := p.Abs()
	if err != nil {
		s.log.Warnf("%v", err)
		return false, nil
	}

	return strings.HasPrefix(abspath.String(), absbase.String()), nil
}
