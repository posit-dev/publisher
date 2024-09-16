package matcher

import (
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type MatchList interface {
	AddFromFile(base util.AbsolutePath, filePath util.AbsolutePath, patterns []string) error
	Match(path util.AbsolutePath) *Pattern
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

func (l *defaultMatchList) AddFromFile(base util.AbsolutePath, filePath util.AbsolutePath, patterns []string) error {
	newFile, err := NewMatchFile(base, filePath, patterns)
	if err != nil {
		return err
	}
	// Add the new file to the end of the list, but keep the builtins last
	l.files = append(l.files[:len(l.files)-1], newFile, l.files[len(l.files)-1])
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
	return match
}
