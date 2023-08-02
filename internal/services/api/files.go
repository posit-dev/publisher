package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"time"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type file struct {
	FileType         fileType `json:"file_type"`         // the file type
	Pathname         string   `json:"pathname"`          // the pathname
	Size             int64    `json:"size"`              // nullable; length in bytes for regular files; system-dependent
	ModifiedDatetime string   `json:"modified_datetime"` // the last modified datetime
	IsDir            bool     `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool     `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool     `json:"is_file"`           // true if the file is a regular file
	IsExcluded       bool     `json:"is_excluded"`       // true if the file is excluded
	Files            []*file  `json:"files"`             // an array of objects of the same type for each file within the directory.
}

func newFile(path util.Path, ignore gitignore.IgnoreList) (*file, error) {
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
		Pathname:         path.Path(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		IsExcluded:       ignore.Match(path.Path()),
		Files:            make([]*file, 0),
	}, nil
}

func NewFilesController(fs afero.Fs, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getFile(fs, log, w, r)
		default:
			// todo - 404
			return
		}
	}
}

func getFile(afs afero.Fs, log rslog.Logger, w http.ResponseWriter, r *http.Request) {
	var pathname string
	if q := r.URL.Query(); q.Has("pathname") {
		pathname = q.Get("pathname")
	} else {
		pathname = "."
	}

	// todo - validate that the pathname is within the working directory
	//
	// https://www.stackhawk.com/blog/golang-path-traversal-guide-examples-and-prevention/
	//
	// Attack Vectors:
	//	- '../' or './src/../../'; i.e., escape the working directory
	// 	- '/' or '/home'; i.e., absolute directories outside of working directory

	path := util.NewPath(pathname, afs)
	file, err := toFile(path, log)
	if err != nil {
		internalError(w, log, err)
		return
	}

	w.Header().Set("content-type", "application/hal+json")
	json.NewEncoder(w).Encode(file)
}

func toFile(path util.Path, log rslog.Logger) (*file, error) {
	ignore := gitignore.New(path)
	root, err := newFile(path, ignore)
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

		child, err := newFile(path, ignore)
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
