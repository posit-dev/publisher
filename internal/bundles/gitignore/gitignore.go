// Copyright 2018 iriri. All rights reserved. Use of this source code is
// governed by a BSD-style license which can be found in the LICENSE file.

// Package gitignore can be used to parse .gitignore-style files into lists of
// globs that can be used to test against paths or selectively walk a file
// tree. Gobwas's glob package is used for matching because it is faster than
// using regexp, which is overkill, and supports globstars (**), unlike
// filepath.Match.

// afero.Fs modifications are
// Copyright (C) 2023 by Posit Software, PBC.

package gitignore

import (
	"bufio"
	"errors"
	"os"
	"os/user"
	"path/filepath"
	"strings"

	"github.com/gobwas/glob"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/spf13/afero"
)

type MatchSource string

const MatchSourceFile MatchSource = "file"
const MatchSourceBuiltIn MatchSource = "built-in"
const MatchSourceUser MatchSource = "user"

type Match struct {
	Source   MatchSource `json:"source"`  // type of match, e.g. file or a caller-provided value
	Pattern  string      `json:"pattern"` // exclusion pattern as read from the file
	glob     glob.Glob   // globs constructed to match the pattern
	FilePath string      `json:"file_path"` // path to the file where this was defined, empty if not from a file
	Line     int         `json:"line"`      // line in the file where this was defined, 0 if not from a file
}

type ignoreFile struct {
	matches []*Match
	abspath []string
}

type GitIgnoreList struct {
	files []ignoreFile
	cwd   []string
	fs    afero.Fs
}

func toSplit(path string) []string {
	return strings.Split(filepath.ToSlash(path), "/")
}

func fromSplit(path []string) string {
	return filepath.FromSlash(strings.Join(path, "/"))
}

// New creates a new ignore list.
func New(cwd util.Path) GitIgnoreList {
	files := make([]ignoreFile, 1, 4)
	return GitIgnoreList{
		files,
		toSplit(cwd.Path()),
		cwd.Fs(),
	}
}

// From creates a new ignore list and populates the first entry with the
// contents of the specified file.
func From(path util.Path) (GitIgnoreList, error) {
	ign := New(path.Dir())
	err := ign.append(path, nil)
	return ign, err
}

// FromGit finds the root directory of the current git repository and creates a
// new ignore list with the contents of all .gitignore files in that git
// repository.
func FromGit(fs afero.Fs) (GitIgnoreList, error) {
	wd, err := util.Getwd(fs)
	if err != nil {
		return GitIgnoreList{}, err
	}
	ign := New(wd)
	err = ign.AppendGit()
	return ign, err
}

func clean(s string) string {
	i := len(s) - 1
	for ; i >= 0; i-- {
		if s[i] != ' ' || i > 0 && s[i-1] == '\\' {
			return s[:i+1]
		}
	}
	return ""
}

func (ign *GitIgnoreList) AppendGlobs(patterns []string, source MatchSource) error {
	f := ignoreFile{}
	for _, pattern := range patterns {
		g, err := glob.Compile(clean(pattern))
		if err != nil {
			return err
		}
		match := &Match{
			Source:  source,
			Pattern: pattern,
			glob:    g,
		}
		f.matches = append(f.matches, match)
	}
	ign.files = append(ign.files, f)
	return nil
}

func toRelpath(s string, dir, cwd []string) string {
	if s != "" {
		if s[0] != '/' {
			return s
		}
		if dir == nil || cwd == nil {
			return s[1:]
		}
		dir = append(dir, toSplit(s[1:])...)
	}

	i := 0
	min := len(cwd)
	if len(dir) < min {
		min = len(dir)
	}
	for ; i < min; i++ {
		if dir[i] != cwd[i] {
			break
		}
	}
	if i == min && len(cwd) == len(dir) {
		return "."
	}

	ss := make([]string, (len(cwd)-i)+(len(dir)-i))
	j := 0
	for ; j < len(cwd)-i; j++ {
		ss[j] = ".."
	}
	for k := 0; j < len(ss); j, k = j+1, k+1 {
		ss[j] = dir[i+k]
	}
	return fromSplit(ss)
}

func (ign *GitIgnoreList) append(path util.Path, dir []string) error {
	f, err := path.Open()
	if err != nil {
		return err
	}
	defer f.Close()

	var ignf *ignoreFile
	if dir != nil {
		ignf = &ign.files[0]
	} else {
		absDir, err := path.Dir().Abs()
		if err != nil {
			return err
		}
		d := absDir.Path()
		if d != fromSplit(ign.cwd) {
			dir = toSplit(d)
			ignf = &ignoreFile{
				abspath: dir,
			}
		} else {
			ignf = &ign.files[0]
		}
	}
	scn := bufio.NewScanner(bufio.NewReader(f))
	line := 0
	for scn.Scan() {
		s := scn.Text()
		line++
		if s == "" || s[0] == '#' {
			continue
		}
		g, err := glob.Compile(toRelpath(clean(s), dir, ign.cwd))
		if err != nil {
			return err
		}
		match := &Match{
			Source:   MatchSourceFile,
			Pattern:  s,
			glob:     g,
			FilePath: path.Path(),
			Line:     line,
		}
		ignf.matches = append(ignf.matches, match)
	}
	ign.files = append(ign.files, *ignf)
	return nil
}

// Append appends the globs in the specified file to the ignore list. Files are
// expected to have the same format as .gitignore files.
func (ign *GitIgnoreList) Append(path util.Path) error {
	return ign.append(path, nil)
}

func (ign *GitIgnoreList) exists(path string) bool {
	_, err := ign.fs.Stat(path)
	return !os.IsNotExist(err)
}

var ErrNotInGitRepo = errors.New("not in a git repository")

func (ign *GitIgnoreList) findGitRoot(cwd []string) (string, error) {
	p := fromSplit(cwd)
	for !ign.exists(p + "/.git") {
		if len(cwd) == 1 {
			return "", ErrNotInGitRepo
		}
		cwd = cwd[:len(cwd)-1]
		p = fromSplit(cwd)
	}
	return p, nil
}

func (ign *GitIgnoreList) appendAll(fname string, root util.Path) error {
	return root.Walk(
		func(path util.Path, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if path.Base() == fname {
				err := ign.append(path, nil)
				if err != nil {
					return err
				}
			}
			return nil
		})
}

// AppendGit finds the root directory of the current git repository and appends
// the contents of all .gitignore files in that git repository to the ignore
// list.
func (ign *GitIgnoreList) AppendGit() error {
	gitRoot, err := ign.findGitRoot(ign.cwd)
	if err != nil {
		return err
	}
	if err = ign.AppendGlobs([]string{".git"}, MatchSourceBuiltIn); err != nil {
		return err
	}
	usr, err := user.Current()
	if err != nil {
		return err
	}
	if gg := filepath.Join(usr.HomeDir, ".gitignore_global"); ign.exists(gg) {
		if err = ign.append(util.NewPath(gg, ign.fs), toSplit(gitRoot)); err != nil {
			return err
		}
	}
	return ign.appendAll(".gitignore", util.NewPath(gitRoot, ign.fs))
}

func isPrefix(abspath, dir []string) bool {
	if len(abspath) > len(dir) {
		return false
	}
	for i := range abspath {
		if abspath[i] != dir[i] {
			return false
		}
	}
	return true
}

func (ign *GitIgnoreList) match(path string, info os.FileInfo) *Match {
	ss := make([]string, 0, 4)
	base := filepath.Base(path)
	ss = append(ss, path)
	if base != path {
		ss = append(ss, base)
	} else {
		ss = append(ss, "./"+path)
	}
	if info != nil && info.IsDir() {
		ss = append(ss, path+"/")
		if base != path {
			ss = append(ss, base+"/")
		} else {
			ss = append(ss, "./"+path+"/")
		}
	}

	d, err := filepath.Abs(filepath.Dir(path))
	if err != nil {
		return nil
	}
	dir := toSplit(d)
	for _, f := range ign.files {
		if isPrefix(f.abspath, dir) || len(f.abspath) == 0 {
			for _, match := range f.matches {
				for _, s := range ss {
					if match.glob.Match(s) {
						return match
					}
				}
			}
		}
	}
	return nil
}

// Match returns whether any of the globs in the ignore list match the
// specified path. Uses the same matching rules as .gitignore files.
func (ign *GitIgnoreList) Match(path string) *Match {
	return ign.match(path, nil)
}

// Walk walks the file tree with the specified root and calls fn on each file
// or directory. Files and directories that match any of the globs in the
// ignore list are skipped.
func (ign *GitIgnoreList) Walk(root util.Path, fn util.WalkFunc) error {
	abs, err := root.Abs()
	if err != nil {
		return err
	}
	return abs.Walk(
		func(path util.Path, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			relPath := toRelpath("", toSplit(path.Path()), ign.cwd)
			if ign.match(relPath, info) != nil {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return err
			}
			return fn(path, info, err)
		})
}
