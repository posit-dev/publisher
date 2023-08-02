package api

import (
	"fmt"
	"io/fs"
)

type fileType string

const (
	Regular   fileType = "REGULAR"
	Directory fileType = "DIR"
)

func getFileType(path string, info fs.FileInfo) (fileType, error) {
	if info.Mode().IsRegular() {
		return Regular, nil
	}

	if info.Mode().IsDir() {
		return Directory, nil
	}

	return "", fmt.Errorf("the file type for file %s is not supported", path)
}
