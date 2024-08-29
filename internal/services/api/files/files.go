package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"time"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/util"
)

type File struct {
	// public fields
	Id               string           `json:"id"`               // a logical (non-universally-unique) identifier
	FileType         fileType         `json:"fileType"`         // the file type
	Base             string           `json:"base"`             // the base name
	Reason           *matcher.Pattern `json:"reason"`           // object describing the reason the file was included/excluded, or null if no pattern matched it
	Files            []*File          `json:"files"`            // an array of objects of the same type for each file within the directory.
	IsDir            bool             `json:"isDir"`            // true if the file is a directory
	IsEntrypoint     bool             `json:"isEntrypoint"`     // true if the file is an entrypoint
	IsRegular        bool             `json:"isFile"`           // true if the file is a regular file
	ModifiedDatetime string           `json:"modifiedDatetime"` // the last modified datetime
	Rel              string           `json:"rel"`              // the relative path to the project root, which is used as the identifier
	RelDir           string           `json:"relDir"`           // the relative path of the directory containing the file
	Size             int64            `json:"size"`             // nullable; length in bytes for regular files; system-dependent
	FileCount        int64            `json:"fileCount"`        // total number of files in the subtree rooted at this node
	Abs              string           `json:"abs"`              // the absolute path
	AllIncluded      bool             `json:"allIncluded"`      // Are all nodes under this one included?
	AllExcluded      bool             `json:"allExcluded"`      // Are all nodes under this one excluded?
}

func CreateFile(root util.AbsolutePath, path util.AbsolutePath, match *matcher.Pattern) (*File, error) {
	rel, err := path.Rel(root)
	if err != nil {
		return nil, err
	}

	info, err := path.Stat()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	filetype, err := getFileType(path.String(), info)
	if err != nil {
		return nil, err
	}

	return &File{
		Id:               rel.ToSlash(),
		FileType:         filetype,
		Rel:              rel.String(),
		RelDir:           rel.Dir().String(),
		Base:             path.Base(),
		Size:             info.Size(),
		ModifiedDatetime: info.ModTime().Format(time.RFC3339),
		IsDir:            info.Mode().IsDir(),
		IsRegular:        info.Mode().IsRegular(),
		Reason:           match,
		Files:            make([]*File, 0),
		Abs:              path.String(),
	}, nil
}

func (f *File) CalculateDirectorySizes() {
	var fileCount int64
	var size int64

	for _, child := range f.Files {
		if child.IsDir {
			child.CalculateDirectorySizes()
		} else {
			child.FileCount = 1
		}
		size += child.Size
		fileCount += child.FileCount
	}
	f.FileCount = fileCount
	f.Size = size
}

func (f *File) CalculateInclusions() {
	if !f.IsDir {
		included := (f.Reason != nil) && !f.Reason.Exclude
		f.AllIncluded = included
		f.AllExcluded = !included
		return
	}
	f.AllIncluded = true
	f.AllExcluded = true

	for _, child := range f.Files {
		child.CalculateInclusions()
		f.AllIncluded = f.AllIncluded && child.AllIncluded
		f.AllExcluded = f.AllExcluded && child.AllExcluded
	}
}

func (f *File) insert(root util.AbsolutePath, path util.AbsolutePath, match *matcher.Pattern) (*File, error) {

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
		child, err := CreateFile(root, path, match)
		if err != nil || child == nil {
			return nil, err
		}

		// then append it to the current file's files
		f.Files = append(f.Files, child)
		return child, nil
	}

	// otherwise, create the parent file
	parent, err := f.insert(root, pathdir, match)
	if err != nil || parent == nil {
		return nil, err
	}

	// then insert this into the parent
	return parent.insert(root, path, match)
}
