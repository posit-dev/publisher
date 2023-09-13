package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"time"

	"github.com/rstudio/publishing-client/internal/bundles/gitignore"
	"github.com/rstudio/publishing-client/internal/util"
)

type File struct {
	// public fields
	Id               string           `json:"id"`                // a logical (non-universally-unique) identifier
	FileType         fileType         `json:"file_type"`         // the file type
	Base             string           `json:"base"`              // the base name
	Exclusion        *gitignore.Match `json:"exclusion"`         // object describing the reason for exclusion, null if not excluded
	Files            []*File          `json:"files"`             // an array of objects of the same type for each file within the directory.
	IsDir            bool             `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool             `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool             `json:"is_file"`           // true if the file is a regular file
	ModifiedDatetime string           `json:"modified_datetime"` // the last modified datetime
	Rel              string           `json:"rel"`               // the relative path to the project root, which is used as the identifier
	Size             int64            `json:"size"`              // nullable; length in bytes for regular files; system-dependent

	// internal fields
	Abs string // the absolute path
}

func CreateFile(root util.Path, path util.Path, exclusion *gitignore.Match) (*File, error) {

	abs, err := path.Abs()
	if err != nil {
		return nil, err
	}

	rel, err := path.Rel(root)
	if err != nil {
		return nil, err
	}

	info, err := path.Stat()
	if err != nil {
		return nil, err
	}

	filetype, err := getFileType(path.String(), info)
	if err != nil {
		return nil, err
	}

	return &File{
		Id:               rel.Path(),
		FileType:         filetype,
		Rel:              rel.Path(),
		Base:             path.Base(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Exclusion:        exclusion,
		Files:            make([]*File, 0),
		Abs:              abs.Path(),
	}, nil
}

func (f *File) insert(root util.Path, path util.Path, ignore gitignore.IgnoreList) (*File, error) {

	// if the path (absolute form) is the same as the file's absolute path
	pabs, _ := path.Abs()
	if f.Abs == pabs.String() {
		// do nothing since this already exists
		return f, nil
	}

	// if the path's parent working directory (absolute path) is the same as the file's absolute path
	pabsdir := pabs.Dir()
	if f.Abs == pabsdir.String() {
		// then iterate through the children files to determine if the file has already been created
		for _, child := range f.Files {
			// if the child's working directory (absolute path) is the same as the file's absolute path
			if child.Abs == pabs.String() {
				// then we found it
				return child, nil
			}
		}

		// otherwise, create it
		exclusion := ignore.Match(path.Path())
		child, err := CreateFile(root, path, exclusion)
		if err != nil {
			return nil, err
		}

		// then append it to the current file's files
		f.Files = append(f.Files, child)
		return child, nil
	}

	// otherwise, create the parent file
	parent, err := f.insert(root, pabsdir, ignore)
	if err != nil {
		return nil, err
	}

	// then insert this into the parent
	return parent.insert(root, path, ignore)
}
