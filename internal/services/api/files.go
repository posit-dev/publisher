package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type FileType string

const (
	Regular   FileType = "REGULAR"
	Directory FileType = "DIR"
)

type File struct {
	FileType         FileType `json:"file_type"`         // the file type
	Pathname         string   `json:"pathname"`          // the pathname
	Size             int64    `json:"size"`              // nullable; length in bytes for regular files; system-dependent
	ModifiedDatetime string   `json:"modified_datetime"` // the last modified datetime
	IsDir            bool     `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool     `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool     `json:"is_file"`           // true if the file is a regular file
	Files            []*File  `json:"files"`             // an array of objects of the same type for each file within the directory.
	// Links            Links   `json:"_links"`
}

func GetFileType(path string, info fs.FileInfo) (FileType, error) {
	if info.Mode().IsRegular() {
		return Regular, nil
	}

	if info.Mode().IsDir() {
		return Directory, nil
	}

	return "", fmt.Errorf("the file type for file %s is not supported", path)
}

func NewFile(afs afero.Fs, path string) (*File, error) {
	info, err := afs.Stat(path)
	if err != nil {
		return nil, err
	}

	filetype, err := GetFileType(path, info)
	if err != nil {
		return nil, err
	}

	return &File{
		FileType:         filetype,
		Pathname:         path,
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Files:            make([]*File, 0),
	}, nil
}

func NewFilesController(fs afero.Fs, log rslog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			GetFile(fs, log, w, r)
		default:
			// todo - 404
			return
		}
	}
}

func GetFile(afs afero.Fs, log rslog.Logger, w http.ResponseWriter, r *http.Request) {
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

	file, err := ToFile(afs, pathname)
	if err != nil {
		internalError(w, log, err)
		return
	}

	w.Header().Set("content-type", "application/hal+json")
	json.NewEncoder(w).Encode(file)
}

func ToFile(afs afero.Fs, path string) (*File, error) {
	root, err := NewFile(afs, path)
	if err != nil {
		return nil, err
	}

	afero.Walk(afs, path, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		_, err = root.Insert(afs, path)
		return err
	})

	return root, nil
}

// Inserts the provided path into the File.
// The insertion logic acts like `mkdir -p` in that it will create any File instances for any intermediate directories that do not already exist.
func (file *File) Insert(afs afero.Fs, path string) (*File, error) {

	if file.Pathname == path {
		return file, nil
	}

	directory := filepath.Dir(path)
	if file.Pathname == directory {
		for _, child := range file.Files {
			if child.Pathname == path {
				return child, nil
			}
		}

		child, err := NewFile(afs, path)
		if err != nil {
			return nil, err
		}

		file.Files = append(file.Files, child)
		return child, nil
	}

	parent, err := file.Insert(afs, directory)
	if err != nil {
		return nil, err
	}

	return parent.Insert(afs, path)
}
