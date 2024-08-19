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
				return nil
			} else {
				return err
			}
		}
		if info.IsDir() {
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if util.IsPythonEnvironmentDir(path) || util.IsRenvLibraryDir(path) {
				return filepath.SkipDir
			}
		}
		_, err = file.insert(p, path, matchList)
		return err
	})

	return file, err
}
