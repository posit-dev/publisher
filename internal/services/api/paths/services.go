package paths

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PathsService interface {
	IsSafe(p util.Path) (bool, error)
}

func CreatePathsService(base util.Path, log logging.Logger) PathsService {
	return pathsService{base, log}
}

type pathsService struct {
	base util.Path
	log  logging.Logger
}

func (s pathsService) IsSafe(p util.Path) (bool, error) {
	symlink, err := s.isSymlink(p)
	if err != nil {
		return false, err
	}
	if symlink {
		s.log.Warn("the provided pathname  is a symlink", "path", p)
		return false, nil
	}

	trusted, err := s.isTrusted(p)
	if err != nil {
		return false, err
	}
	if !trusted {
		s.log.Warn("the provided pathname is not trusted", "path", p)
		return false, nil
	}

	return true, nil
}

func (s pathsService) isSymlink(p util.Path) (bool, error) {
	l, ok, err := p.LstatIfPossible()
	if err != nil {
		// if an error occurs and lstat is called, check if the error op is lstat
		if ok {
			perr, pok := err.(*os.PathError)
			// if cast is ok and err op is lstat, return (false, nil) since it is not a symlink
			if pok && (perr.Op == "lstat" || perr.Op == "CreateFile") {
				return false, nil
			}
		}
		// otherwise, return (false, err) if lstat was not called.
		return false, err
	}
	return (l.Mode() & os.ModeSymlink) != 0, nil

}

func (s pathsService) isTrusted(p util.Path) (bool, error) {
	_, err := p.Rel(s.base)
	if err != nil {
		return false, err
	}

	absbase, err := s.base.Abs()
	if err != nil {
		return false, err
	}

	abspath, err := p.Abs()
	if err != nil {
		return false, err
	}

	return strings.HasPrefix(abspath.String(), absbase.String()), nil
}
