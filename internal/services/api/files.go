package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"time"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/services/api/pathnames"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type file struct {
	FileType         fileType         `json:"file_type"`         // the file type
	Pathname         string           `json:"pathname"`          // the pathname
	BaseName         string           `json:"base_name"`         // the file name
	Size             int64            `json:"size"`              // nullable; length in bytes for regular files; system-dependent
	ModifiedDatetime string           `json:"modified_datetime"` // the last modified datetime
	IsDir            bool             `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool             `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool             `json:"is_file"`           // true if the file is a regular file
	Exclusion        *gitignore.Match `json:"exclusion"`         // object describing the reason for exclusion, null if not excluded
	Files            []*file          `json:"files"`             // an array of objects of the same type for each file within the directory.
}

func newFile(path util.Path, exclusion *gitignore.Match) (*file, error) {
	info, err := path.Stat()
	if err != nil {
		return nil, err
	}

	filetype, err := getFileType(path.Path(), info)
	if err != nil {
		return nil, err
	}

	return &file{
		FileType:         filetype,
		BaseName:         path.Base(),
		Pathname:         path.Path(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Exclusion:        exclusion,
		Files:            make([]*file, 0),
	}, nil
}

func (f *file) insert(path util.Path, ignore gitignore.GitIgnoreList) (*file, error) {

	if f.Pathname == path.Path() {
		return f, nil
	}

	directory := path.Dir()
	if f.Pathname == directory.Path() {
		for _, child := range f.Files {
			if child.Pathname == path.Path() {
				return child, nil
			}
		}

		exclusion := ignore.Match(path.Path())
		child, err := newFile(path, exclusion)
		if err != nil {
			return nil, err
		}

		f.Files = append(f.Files, child)
		return child, nil
	}

	parent, err := f.insert(directory, ignore)
	if err != nil {
		return nil, err
	}

	return parent.insert(path, ignore)
}

func NewFilesController(cwd util.Path, fs afero.Fs, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getFile(cwd, fs, log, w, r)
		default:
			return
		}
	}
}

func getFile(cwd util.Path, afs afero.Fs, log rslog.Logger, w http.ResponseWriter, r *http.Request) {
	var p pathnames.Pathname
	if q := r.URL.Query(); q.Has("pathname") {
		p = pathnames.Create(q.Get("pathname"), afs, log)
	} else {
		p = pathnames.Create(cwd.String(), afs, log)
	}

	ok, err := p.IsSafe(cwd)
	if err != nil {
		InternalError(w, log, err)
		return
	}

	// if pathname is not safe, return 403 - Forbidden
	if !ok {
		log.Warnf("the pathname '%s' is not safe", p)
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(http.StatusText(http.StatusForbidden)))
		return
	}

	path := util.NewPath(p.String(), afs)
	file, err := toFile(cwd, path, log)
	if err != nil {
		InternalError(w, log, err)
		return
	}

	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(file)
}

func toFile(cwd util.Path, path util.Path, log rslog.Logger) (*file, error) {
	path = path.Clean()
	ignore := gitignore.New(cwd.Join(".gitignore"))

	exclusion := ignore.Match(path.Path())
	root, err := newFile(path, exclusion)
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(util.FSWalker{}, log)
	walker.Walk(path, func(path util.Path, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		_, err = root.insert(path, ignore)
		return err
	})

	return root, nil
}
