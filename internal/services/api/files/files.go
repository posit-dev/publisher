package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"time"

	"github.com/rstudio/connect-client/internal/bundles/matcher"
	"github.com/rstudio/connect-client/internal/util"
)

type File struct {
	// public fields
	Id               string           `json:"id"`               // a logical (non-universally-unique) identifier
	FileType         fileType         `json:"fileType"`         // the file type
	Base             string           `json:"base"`             // the base name
	Exclusion        *matcher.Pattern `json:"exclusion"`        // object describing the reason for exclusion, null if not excluded
	Files            []*File          `json:"files"`            // an array of objects of the same type for each file within the directory.
	IsDir            bool             `json:"isDir"`            // true if the file is a directory
	IsEntrypoint     bool             `json:"isEntrypoint"`     // true if the file is an entrypoint
	IsRegular        bool             `json:"isFile"`           // true if the file is a regular file
	ModifiedDatetime string           `json:"modifiedDatetime"` // the last modified datetime
	Rel              string           `json:"rel"`              // the relative path to the project root, which is used as the identifier
	Size             int64            `json:"size"`             // nullable; length in bytes for regular files; system-dependent
	Abs              string           `json:"abs"`              // the absolute path
}

func CreateFile(root util.AbsolutePath, path util.AbsolutePath, match *matcher.Pattern) (*File, error) {
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
		Id:               rel.String(),
		FileType:         filetype,
		Rel:              rel.String(),
		Base:             path.Base(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Exclusion:        match,
		Files:            make([]*File, 0),
		Abs:              path.String(),
	}, nil
}

func (f *File) insert(root util.AbsolutePath, path util.AbsolutePath, matchList matcher.MatchList) (*File, error) {

	// if the path is the same as the file's absolute path
	if f.Abs == path.String() {
		// do nothing since this already exists
		return f, nil
	}

	// if the path's parent working directory (absolute path) is the same as the file's absolute path
	pathdir := path.Dir()
	if f.Abs == pathdir.String() {
		// then iterate through the children files to determine if the file has already been created
		for _, child := range f.Files {
			// if the child's working directory (absolute path) is the same as the file's absolute path
			if child.Abs == path.String() {
				// then we found it
				return child, nil
			}
		}

		// otherwise, create it
		match := matchList.Match(path)

		child, err := CreateFile(root, path, match)
		if err != nil {
			return nil, err
		}

		// then append it to the current file's files
		f.Files = append(f.Files, child)
		return child, nil
	}

	// otherwise, create the parent file
	parent, err := f.insert(root, pathdir, matchList)
	if err != nil {
		return nil, err
	}

	// then insert this into the parent
	return parent.insert(root, path, matchList)
}
