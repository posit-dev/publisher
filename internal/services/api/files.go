package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
)

type File struct {
	Pathname         string `json:"pathname"`          // the relative file name
	Size             uint   `json:"size"`              // nullable; length in bytes for regular files; system-dependent
	ModifiedDatetime string `json:"modified_datetime"` // the last modified datetime
	IsDir            bool   `json:"is_dir"`            // true if the file is a directory
	IsEntrypoint     bool   `json:"is_entrypoint"`     // true if the file is an entrypoint
	IsRegular        bool   `json:"is_file"`           // true if the file is a regular file
	Files            []File `json:"files"`             // An array of objects of the same type for each file within the directory.
	Links            Links  `json:"_links"`
}

func GetFile(pathname string) *File {
	return &File{
		Pathname: pathname,
	}
}

func NewFilesController() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		var file *File
		if q.Has("pathname") {
			pathname := q.Get("pathname")
			file = GetFile(pathname)
		} else {
			file = GetFile(".")
		}
		w.Header().Set("content-type", "application/hal+json")
		json.NewEncoder(w).Encode(file)
	}
}
