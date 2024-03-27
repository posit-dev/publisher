package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type FilesService interface {
	GetFile(path util.AbsolutePath, ignore gitignore.IgnoreList) (*File, error)
}

func CreateFilesService(base util.AbsolutePath, log logging.Logger) FilesService {
	return filesService{
		root: base,
		log:  log,
	}
}

type filesService struct {
	root util.AbsolutePath
	log  logging.Logger
}

func (s filesService) GetFile(p util.AbsolutePath, ignore gitignore.IgnoreList) (*File, error) {
	oldWD, err := util.Chdir(p.String())
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	p = p.Clean()
	m := ignore.Match(p)

	file, err := CreateFile(s.root, p, m)
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, s.log)
	err = walker.Walk(p, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if util.IsPythonEnvironmentDir(path) {
				return filepath.SkipDir
			}
			// Load .positignore from every directory where it exists
			err = gitignore.LoadPositIgnoreIfPresent(path, ignore)
			if err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}
		_, err = file.insert(s.root, path, ignore)
		return err
	})

	return file, err
}
