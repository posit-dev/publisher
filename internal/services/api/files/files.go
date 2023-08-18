package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"time"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/util"
)

type File struct {
	FileType         fileType         `json:"file_type"`         // the file type
	Pathname         string           `json:"pathname"`          // the pathname
	BaseName         string           `json:"base_name"`         // the file name
	Size             int64            `json:"size"`              // nullable; length in bytes for regular files; system-dependent
	ModifiedDatetime string           `json:"modified_datetime"` // the last modified datetime
	IsDir            bool             `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool             `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool             `json:"is_file"`           // true if the file is a regular file
	Exclusion        *gitignore.Match `json:"exclusion"`         // object describing the reason for exclusion, null if not excluded
	Files            []*File          `json:"files"`             // an array of objects of the same type for each file within the directory.
}

func CreateFile(path util.Path, exclusion *gitignore.Match) (*File, error) {
	info, err := path.Stat()
	if err != nil {
		return nil, err
	}

	filetype, err := getFileType(path.String(), info)
	if err != nil {
		return nil, err
	}

	return &File{
		FileType:         filetype,
		BaseName:         path.Base(),
		Pathname:         path.Path(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Exclusion:        exclusion,
		Files:            make([]*File, 0),
	}, nil
}

func (f *File) insert(path util.Path, ignore gitignore.IgnoreList) (*File, error) {

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
		child, err := CreateFile(path, exclusion)
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
