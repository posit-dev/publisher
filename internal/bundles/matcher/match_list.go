package matcher

import (
	"os"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type MatchList interface {
	AddFile(path util.AbsolutePath) error
	Match(path util.AbsolutePath) *Pattern
	Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error
}

type defaultMatchList struct {
	files []*MatchFile
}

func NewMatchList(base util.AbsolutePath, builtins []string) (*defaultMatchList, error) {
	f, err := NewBuiltinMatchFile(base, builtins)
	if err != nil {
		return nil, err
	}
	return &defaultMatchList{
		files: []*MatchFile{f},
	}, nil
}

func (l *defaultMatchList) AddFile(path util.AbsolutePath) error {
	newFile, err := NewMatchFile(path)
	if err != nil {
		return err
	}
	l.files = append(l.files, newFile)
	return nil
}

func (l *defaultMatchList) Match(filePath util.AbsolutePath) *Pattern {
	var match *Pattern

	pathString := filePath.ToSlash()
	isDir, err := filePath.IsDir()
	if err == nil && isDir {
		pathString += "/"
	}

	for _, f := range l.files {
		fileMatch := f.Match(pathString)
		if fileMatch != nil {
			match = fileMatch
		}
	}
	if match == nil || match.Inverted {
		// No match, or the match is inverted so the file should not be ignored.
		return nil
	}
	return match
}

func (l *defaultMatchList) Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	return root.Walk(
		func(path util.AbsolutePath, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if l.Match(path) == nil {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			return fn(path, info, err)
		})
}
