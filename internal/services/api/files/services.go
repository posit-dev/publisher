package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/spf13/afero"
)

type FilesService interface {
	GetFile(path util.Path) (*File, error)
}

func CreateFilesService(base util.Path, afs afero.Fs, log events.Logger) FilesService {
	f := base.Join(".gitignore")
	ignore, err := gitignore.NewIgnoreList(f, nil)
	if err != nil {
		log.Warn("failed to load .gitignore file")
	}
	return filesService{
		base:   base,
		afs:    afs,
		log:    log,
		ignore: ignore,
	}
}

type filesService struct {
	base   util.Path
	afs    afero.Fs
	log    events.Logger
	ignore gitignore.IgnoreList
}

func (s filesService) GetFile(p util.Path) (*File, error) {
	p = p.Clean()
	m := s.ignore.Match(p.String())
	file, err := CreateFile(p, m)
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, s.log.Logger)
	err = walker.Walk(p, func(path util.Path, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		_, err = file.insert(path.Clean(), s.ignore)
		return err
	})

	return file, err
}
