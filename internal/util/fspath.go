package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/afero"
)

type Path struct {
	path string
	fs   afero.Fs
}

var osFs = afero.NewOsFs()

func NewPath(path string, fs afero.Fs) Path {
	if fs == nil {
		fs = osFs
	}
	return Path{
		path: path,
		fs:   fs,
	}
}

func (p *Path) UnmarshalText(data []byte) error {
	p.path = string(data)
	p.fs = osFs
	return nil
}

func (p Path) String() string {
	return p.path
}

func (p Path) Path() string {
	return p.path
}

func (p Path) Fs() afero.Fs {
	return p.fs
}

func (p Path) WithPath(path string) Path {
	return NewPath(path, p.fs)
}

func (p Path) Abs() (Path, error) {
	absPath, err := filepath.Abs(p.path)
	if err != nil {
		return Path{}, err
	}
	return p.WithPath(absPath), nil
}

func (p Path) Base() string {
	return filepath.Base(p.path)
}

func (p Path) Clean() Path {
	return p.WithPath(filepath.Clean(p.path))
}

func (p Path) Dir() Path {
	return p.WithPath(filepath.Dir(p.path))
}

func (p Path) Ext() string {
	return filepath.Ext(p.path)
}

func PathFromSlash(fs afero.Fs, path string) Path {
	return NewPath(filepath.FromSlash(path), fs)
}

func PathFromEnvironment(envVar string, fs afero.Fs) Path {
	return NewPath(os.Getenv(envVar), fs)
}

func Getwd(fs afero.Fs) (Path, error) {
	wd, err := os.Getwd()
	if err != nil {
		return Path{}, err
	}
	return NewPath(wd, fs), nil
}

func UserHomeDir(fs afero.Fs) (Path, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return Path{}, err
	}
	return NewPath(home, fs), nil
}

func (p Path) Glob(pattern string) ([]Path, error) {
	matches, err := afero.Glob(p.fs, p.Join(pattern).Path())
	if err != nil {
		return nil, err
	}
	paths := make([]Path, len(matches))
	for i, match := range matches {
		paths[i] = NewPath(match, p.fs)
	}
	return paths, nil
}

func (p Path) IsAbs() bool {
	return filepath.IsAbs(p.path)
}

func (p Path) IsLocal() bool {
	return filepath.IsLocal(p.path)
}

func (p Path) Join(other ...string) Path {
	elems := append([]string{p.path}, other...)
	return NewPath(
		filepath.Join(elems...),
		p.fs)
}

func (p Path) Match(pattern string) (matched bool, err error) {
	return filepath.Match(pattern, p.path)
}

func (p Path) Rel(basepath Path) (Path, error) {
	relPath, err := filepath.Rel(basepath.path, p.path)
	if err != nil {
		return Path{}, err
	}
	return p.WithPath(relPath), nil
}

func (p Path) Split() (Path, string) {
	dir, file := filepath.Split(p.path)
	return NewPath(dir, p.fs), file
}

func (p Path) SplitList() []string {
	return filepath.SplitList(p.path)
}

func (p Path) ToSlash() string {
	return filepath.ToSlash(p.path)
}

func (p Path) VolumeName(path string) string {
	return filepath.VolumeName(p.path)
}

type WalkFunc func(path Path, info fs.FileInfo, err error) error

func (p Path) Walk(fn WalkFunc) error {
	return afero.Walk(p.fs, p.path, func(path string, info fs.FileInfo, err error) error {
		return fn(NewPath(path, p.fs), info, err)
	})
}

func (p Path) IsDir() (bool, error) {
	return afero.IsDir(p.fs, p.path)
}

func (p Path) Exists() (bool, error) {
	return afero.Exists(p.fs, p.path)
}

func (p Path) DirExists() (bool, error) {
	return afero.DirExists(p.fs, p.path)
}

func (p Path) IsEmpty() (bool, error) {
	return afero.IsEmpty(p.fs, p.path)
}

func (p Path) ReadFile() ([]byte, error) {
	return afero.ReadFile(p.fs, p.path)
}

func (p Path) ReadDir() ([]os.FileInfo, error) {
	return afero.ReadDir(p.fs, p.path)
}

func (p Path) WriteFile(data []byte, perm os.FileMode) error {
	return afero.WriteFile(p.fs, p.path, data, perm)
}

func (p Path) TempFile(pattern string) (afero.File, error) {
	return afero.TempFile(p.fs, p.path, pattern)
}

func (p Path) TempDir(prefix string) (Path, error) {
	dir, err := afero.TempDir(p.fs, p.path, prefix)
	if err != nil {
		return Path{}, err
	}
	return NewPath(dir, p.fs), nil
}

func (p Path) WriteReader(r io.Reader) error {
	return afero.WriteReader(p.fs, p.path, r)
}

func (p Path) HasSuffix(suffix string) bool {
	return strings.HasSuffix(string(p.path), suffix)
}

func (p Path) Chmod(mode os.FileMode) error {
	return p.fs.Chmod(p.path, mode)
}

func (p Path) Chown(uid int, gid int) error {
	return p.fs.Chown(p.path, uid, gid)
}

func (p Path) Chtimes(atime, mtime time.Time) error {
	return p.fs.Chtimes(p.path, atime, mtime)
}

func (p Path) Create() (afero.File, error) {
	return p.fs.Create(p.path)
}

func (p Path) Mkdir(perm os.FileMode) error {
	return p.fs.Mkdir(p.path, perm)
}

func (p Path) MkdirAll(perm os.FileMode) error {
	return p.fs.MkdirAll(p.path, perm)
}

func (p Path) Open() (afero.File, error) {
	return p.fs.Open(p.path)
}

func (p Path) OpenFile(flag int, perm os.FileMode) (afero.File, error) {
	return p.fs.OpenFile(p.path, flag, perm)
}

func (p Path) Remove() error {
	return p.fs.Remove(p.path)
}

func (p Path) RemoveAll() error {
	return p.fs.RemoveAll(p.path)
}

func (p Path) Rename(newPath Path) error {
	return p.fs.Rename(p.path, newPath.path)
}

func (p Path) RenameStr(newName string) error {
	return p.fs.Rename(p.path, newName)
}

func (p Path) Stat() (os.FileInfo, error) {
	return p.fs.Stat(p.path)
}

func (p Path) SymlinkIfPossible(target Path) error {
	fs, ok := p.fs.(afero.Linker)
	if !ok {
		return afero.ErrNoSymlink
	}
	return fs.SymlinkIfPossible(target.path, p.path)
}

func (p Path) LstatIfPossible() (fs.FileInfo, bool, error) {
	fs, ok := p.fs.(afero.Lstater)
	if !ok {
		info, err := p.fs.Stat(p.path)
		return info, false, err
	}
	return fs.LstatIfPossible(p.path)
}

func (p Path) ReadlinkIfPossible() (Path, error) {
	fs, ok := p.fs.(afero.LinkReader)
	if !ok {
		return Path{}, afero.ErrNoReadlink
	}
	target, err := fs.ReadlinkIfPossible(p.path)
	if err != nil {
		return Path{}, err
	}
	return NewPath(target, p.fs), nil
}
