package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type FilesService interface {
	GetFile(path util.AbsolutePath, matchList matcher.MatchList) (*File, error)
}

func CreateFilesService(base util.AbsolutePath, log logging.Logger) FilesService {
	return filesService{
		log: log,
	}
}

type filesService struct {
	log logging.Logger
}

func (s filesService) GetFile(p util.AbsolutePath, matchList matcher.MatchList) (*File, error) {
	oldWD, err := util.Chdir(p.String())
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	p = p.Clean()
	m := matchList.Match(p)

	file, err := CreateFile(p, p, m)
	if err != nil || file == nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, s.log)
	err = walker.Walk(p, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				// File was deleted since readdir() was called
				return nil
			} else if errors.Is(err, os.ErrPermission) {
				s.log.Warn("permission error; skipping", "path", path)
				return nil
			} else {
				return err
			}
		}
		match := matchList.Match(path)

		if info.IsDir() {
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if util.IsPythonEnvironmentDir(path) || util.IsRenvLibraryDir(path) {
				return filepath.SkipDir
			}

			// For directories, detect permissions issues earlier so we can
			// attach an exclusion to the generated node.
			_, err = path.ReadDirNames()
			if errors.Is(err, os.ErrPermission) {
				s.log.Warn("permission error; skipping", "path", path)

				// Return an exclusion reason indicating why this can't be included.
				match = &matcher.Pattern{
					Source:  matcher.MatchSourcePermissionsError,
					Exclude: true,
				}
				_, err = file.insert(p, path, match)
				if err != nil {
					return err
				}
				return filepath.SkipDir
			}
		}
		_, err = file.insert(p, path, match)
		return err
	})

	file.CalculateInclusions()
	file.CalculateDirectorySizes()
	return file, err
}
