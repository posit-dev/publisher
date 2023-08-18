package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type IFilesService interface {
	GetFile(path util.Path) (*File, error)
}

func CreateFilesService(base util.Path, afs afero.Fs, log rslog.Logger) IFilesService {
	f := base.Join(".gitignore")
	ignore, err := gitignore.NewIgnoreList(f, nil)
	if err != nil {
		log.Warnf("failed to load .gitignore file")
	}
	return FilesService{
		base:   base,
		afs:    afs,
		log:    log,
		ignore: ignore,
	}
}

type FilesService struct {
	base   util.Path
	afs    afero.Fs
	log    rslog.Logger
	ignore gitignore.IgnoreList
}

func (s FilesService) GetFile(p util.Path) (*File, error) {
	m := s.ignore.Match(p.String())
	file, err := CreateFile(p, m)
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, s.log)
	err = walker.Walk(p, func(path util.Path, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		_, err = file.insert(path, s.ignore)
		return err
	})

	return file, err
}
