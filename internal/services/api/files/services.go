package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type FilesService interface {
	GetFile(path util.Path) (*File, error)
}

func CreateFilesService(base util.Path, log logging.Logger) FilesService {
	ignore, err := gitignore.NewIgnoreList(base, nil)
	if err != nil {
		log.Warn("failed to load .gitignore file")
	}
	return filesService{
		root:   base,
		log:    log,
		ignore: ignore,
	}
}

type filesService struct {
	root   util.Path
	log    logging.Logger
	ignore gitignore.IgnoreList
}

func (s filesService) GetFile(p util.Path) (*File, error) {
	p = p.Clean()
	m, err := s.ignore.Match(p.String())
	if err != nil {
		return nil, err
	}

	file, err := CreateFile(s.root, p, m)
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, s.log)
	err = walker.Walk(p, func(path util.Path, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		_, err = file.insert(s.root, path, s.ignore)
		return err
	})

	return file, err
}
