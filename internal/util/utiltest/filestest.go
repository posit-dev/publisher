package utiltest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"os"
	"time"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
)

type MockFs struct {
	mock.Mock
}

type MockFile struct {
	mock.Mock
}

type MockFileInfo struct {
	mock.Mock
}

func NewMockFs() *MockFs {
	return &MockFs{}
}

func NewMockFile() *MockFile {
	return &MockFile{}
}

func NewMockFileInfo() *MockFileInfo {
	return &MockFileInfo{}
}

// It should satisfy the afero.Fs interfaces
var _ afero.Fs = &MockFs{}
var _ afero.File = &MockFile{}
var _ fs.FileInfo = &MockFileInfo{}

func (m *MockFs) Chmod(name string, mode os.FileMode) error {
	args := m.Called(name, mode)
	return args.Error(0)
}

func (m *MockFs) Chown(name string, uid, gid int) error {
	args := m.Called(name, uid, gid)
	return args.Error(0)
}

func (m *MockFs) Chtimes(name string, atime time.Time, mtime time.Time) error {
	args := m.Called(name, atime, mtime)
	return args.Error(0)
}

func (m *MockFs) Create(name string) (afero.File, error) {
	args := m.Called(name)
	f := args.Get(0)
	if f == nil {
		return nil, args.Error(1)
	} else {
		return args.Get(0).(afero.File), args.Error(1)
	}
}

func (m *MockFs) Mkdir(name string, perm os.FileMode) error {
	args := m.Called(name, perm)
	return args.Error(0)
}

func (m *MockFs) MkdirAll(path string, perm os.FileMode) error {
	args := m.Called(path, perm)
	return args.Error(0)
}

func (m *MockFs) Name() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockFs) Open(name string) (afero.File, error) {
	args := m.Called(name)
	f := args.Get(0)
	if f == nil {
		return nil, args.Error(1)
	} else {
		return args.Get(0).(afero.File), args.Error(1)
	}
}

func (m *MockFs) OpenFile(name string, flag int, perm os.FileMode) (afero.File, error) {
	args := m.Called(name, flag, perm)
	f := args.Get(0)
	if f == nil {
		return nil, args.Error(1)
	} else {
		return args.Get(0).(afero.File), args.Error(1)
	}
}

func (m *MockFs) Remove(name string) error {
	args := m.Called(name)
	return args.Error(0)
}

func (m *MockFs) RemoveAll(path string) error {
	args := m.Called(path)
	return args.Error(0)
}

func (m *MockFs) Rename(oldname, newname string) error {
	args := m.Called(oldname, newname)
	return args.Error(0)
}

func (m *MockFs) Stat(name string) (os.FileInfo, error) {
	args := m.Called(name)
	return args.Get(0).(os.FileInfo), args.Error(1)
}

func (m *MockFile) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockFile) Read(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockFile) ReadAt(p []byte, off int64) (n int, err error) {
	args := m.Called(p, off)
	return args.Int(0), args.Error(1)
}

func (m *MockFile) Seek(offset int64, whence int) (int64, error) {
	args := m.Called(offset, whence)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockFile) Write(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockFile) WriteAt(p []byte, off int64) (n int, err error) {
	args := m.Called(p, off)
	return args.Int(0), args.Error(1)
}

func (m *MockFile) Name() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockFile) Readdir(count int) ([]os.FileInfo, error) {
	args := m.Called(count)
	return args.Get(0).([]os.FileInfo), args.Error(1)
}

func (m *MockFile) Readdirnames(n int) ([]string, error) {
	args := m.Called(n)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockFile) Stat() (os.FileInfo, error) {
	args := m.Called()
	return args.Get(0).(os.FileInfo), args.Error(1)
}

func (m *MockFile) Sync() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockFile) Truncate(size int64) error {
	args := m.Called(size)
	return args.Error(0)
}

func (m *MockFile) WriteString(s string) (int, error) {
	args := m.Called(s)
	return args.Int(0), args.Error(1)
}

func (m *MockFileInfo) Name() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockFileInfo) Size() int64 {
	args := m.Called()
	return args.Get(0).(int64)
}

func (m *MockFileInfo) Mode() fs.FileMode {
	args := m.Called()
	return args.Get(0).(fs.FileMode)
}

func (m *MockFileInfo) ModTime() time.Time {
	args := m.Called()
	return args.Get(0).(time.Time)
}

func (m *MockFileInfo) IsDir() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockFileInfo) Sys() any {
	args := m.Called()
	return args.Get(0)
}
