package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/spf13/afero"
)

type Nothing struct{}

type FilteredFS struct {
	base       afero.Fs
	validPaths map[string]Nothing
}

func NewFilteredFS(base afero.Fs, paths []string) *FilteredFS {
	validPaths := map[string]Nothing{}
	for _, path := range paths {
		validPaths[path] = Nothing{}
	}
	return &FilteredFS{
		base:       base,
		validPaths: validPaths,
	}
}

var errFilteredCannotCreate = errors.New("cannot create: filtered filesystem")
var errFilteredNotFound = errors.New("not found: filtered filesystem")

func (fs *FilteredFS) Create(name string) (afero.File, error) {
	return nil, errFilteredCannotCreate
}

func (fs *FilteredFS) Mkdir(name string, perm os.FileMode) error {
	return errFilteredCannotCreate
}

func (fs *FilteredFS) MkdirAll(path string, perm os.FileMode) error {
	return errFilteredCannotCreate
}

func (fs *FilteredFS) Open(name string) (afero.File, error) {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.Open(name)
	} else {
		return nil, errFilteredNotFound
	}
}

func (fs *FilteredFS) OpenFile(name string, flag int, perm os.FileMode) (afero.File, error) {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.OpenFile(name, flag, perm)
	} else {
		return nil, errFilteredNotFound
	}
}

func (fs *FilteredFS) Remove(name string) error {
	_, ok := fs.validPaths[name]
	if ok {
		err := fs.base.Remove(name)
		if err != nil {
			return err
		}
		delete(fs.validPaths, name)
		return nil
	} else {
		return errFilteredNotFound
	}
}

func (fs *FilteredFS) RemoveAll(path string) error {
	_, ok := fs.validPaths[path]
	if ok {
		err := fs.base.RemoveAll(path)
		if err != nil {
			return err
		}
		for maybeRemove := range fs.validPaths {
			if strings.HasPrefix(maybeRemove, path) {
				delete(fs.validPaths, maybeRemove)
			}
		}
		return nil
	} else {
		return errFilteredNotFound
	}
}

func (fs *FilteredFS) Rename(oldname, newname string) error {
	_, ok := fs.validPaths[oldname]
	if ok {
		err := fs.base.Rename(oldname, newname)
		if err != nil {
			return err
		}
		delete(fs.validPaths, oldname)
		fs.validPaths[newname] = Nothing{}
		return nil
	} else {
		return errFilteredNotFound
	}
}

func (fs *FilteredFS) Stat(name string) (os.FileInfo, error) {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.Stat(name)
	} else {
		return nil, errFilteredNotFound
	}
}

func (fs *FilteredFS) Name() string {
	return "FilteredFS"
}

func (fs *FilteredFS) Chmod(name string, mode os.FileMode) error {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.Chmod(name, mode)
	} else {
		return errFilteredNotFound
	}
}

func (fs *FilteredFS) Chown(name string, uid, gid int) error {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.Chown(name, uid, gid)
	} else {
		return errFilteredNotFound
	}
}

func (fs *FilteredFS) Chtimes(name string, atime time.Time, mtime time.Time) error {
	_, ok := fs.validPaths[name]
	if ok {
		return fs.base.Chtimes(name, atime, mtime)
	} else {
		return errFilteredNotFound
	}
}
