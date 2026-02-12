package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
)

type fileType string

const (
	Regular   fileType = "REGULAR"
	Directory fileType = "DIR"
)

// ErrUnsupportedFileType is returned when encountering a file type that is not
// a regular file or directory (e.g., Unix sockets, named pipes, device files).
var ErrUnsupportedFileType = errors.New("unsupported file type")

func getFileType(info fs.FileInfo) (fileType, error) {
	if info.Mode().IsRegular() {
		return Regular, nil
	}

	if info.Mode().IsDir() {
		return Directory, nil
	}

	return "", ErrUnsupportedFileType
}
