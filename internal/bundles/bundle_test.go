package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles/bundlestest"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type TarSuite struct {
	utiltest.Suite
}

func TestTarSuite(t *testing.T) {
	suite.Run(t, new(TarSuite))
}

func (s *TarSuite) newFileInfo(isDir bool) fs.FileInfo {
	ts := time.Now()
	fileInfo := utiltest.NewMockFileInfo()
	fileInfo.On("IsDir").Return(isDir)
	fileInfo.On("Mode").Return(fs.FileMode(0))
	fileInfo.On("Name").Return("index.html")
	fileInfo.On("Size").Return(int64(100))
	fileInfo.On("ModTime").Return(ts)
	fileInfo.On("Sys").Return(nil, false)
	return fileInfo
}

func (s *TarSuite) TestWriteHeaderToTarFile() {
	fileInfo := s.newFileInfo(false)
	w := utiltest.NewMockTarWriter()

	w.On("WriteHeader", mock.Anything).Return(nil)
	err := writeHeaderToTar(fileInfo, fileInfo.Name(), w)
	s.Nil(err)
}

func (s *TarSuite) TestWriteHeaderToTarDir() {
	fileInfo := s.newFileInfo(true)
	w := utiltest.NewMockTarWriter()

	w.On("WriteHeader", mock.Anything).Return(nil)
	err := writeHeaderToTar(fileInfo, fileInfo.Name(), w)
	s.Nil(err)
	header := w.Calls[0].Arguments[0].(*tar.Header)
	filenameInTar := header.Name
	s.True(strings.HasSuffix(filenameInTar, "/"))
}

func (s *TarSuite) TestWriteHeaderToTarNoArchive() {
	err := writeHeaderToTar(utiltest.NewMockFileInfo(), "", nil)
	s.Nil(err)
}

func (s *TarSuite) TestWriteHeaderToTarRootDir() {
	err := writeHeaderToTar(utiltest.NewMockFileInfo(), ".", utiltest.NewMockTarWriter())
	s.Nil(err)
}

func (s *TarSuite) TestWriteHeaderToTarNilFileInfo() {
	w := utiltest.NewMockTarWriter()
	err := writeHeaderToTar(nil, "hi", w)
	s.NotNil(err)
}

func (s *TarSuite) TestWriteHeaderToTarErr() {
	fileInfo := s.newFileInfo(false)
	w := utiltest.NewMockTarWriter()

	testError := errors.New("test error from WriteHeader")
	w.On("WriteHeader", mock.Anything).Return(testError)
	err := writeHeaderToTar(fileInfo, fileInfo.Name(), w)
	s.ErrorIs(err, testError)
}

func (s *TarSuite) TestWriteFileContentsToTar() {
	fs := afero.NewMemMapFs()
	contents := []byte("abcdefg\n")
	err := afero.WriteFile(fs, "testfile", contents, 0600)
	s.Nil(err)

	w := utiltest.NewMockTarWriter()
	w.On("Write", mock.Anything).Return(len(contents), nil)
	f, err := fs.Open("testfile")
	s.Nil(err)
	defer f.Close()
	md5sum, err := writeFileContentsToTar(f, w)
	s.Nil(err)
	s.Equal([]byte{0x02, 0x08, 0x61, 0xc8, 0xc3, 0xfe, 0x17, 0x7d, 0xa1, 0x9a, 0x7e, 0x95, 0x39, 0xa5, 0xdb, 0xac}, md5sum)
}

func (s *TarSuite) TestWriteFileContentsToTarWriteErr() {
	fs := afero.NewMemMapFs()
	contents := []byte("abcdefg\n")
	err := afero.WriteFile(fs, "testfile", contents, 0600)
	s.Nil(err)

	w := utiltest.NewMockTarWriter()
	testError := errors.New("test error from Write")
	w.On("Write", mock.Anything).Return(0, testError)
	f, err := fs.Open("testfile")
	s.Nil(err)
	defer f.Close()
	md5sum, err := writeFileContentsToTar(f, w)
	s.ErrorIs(err, testError)
	s.Nil(md5sum)
}

type BundlerSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.AbsolutePath
}

func TestBundlerSuite(t *testing.T) {
	suite.Run(t, new(BundlerSuite))
}

func (s *BundlerSuite) SetupSuite() {
	// Our testdata/bundle_dir needs to contain a non-regular
	// file, but you can't check a fifo into git of course.
	tarPath := s.cwd.Join("testdata", "symlink_test", "fifo.tar")
	cmd := exec.Command("tar", "xvf", tarPath.String())
	err := cmd.Run()
	s.Nil(err)
}

func (s *BundlerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd
	// Create a virtual version of the cwd so NewBundleFrom*
	// can Chdir there. This is needed because the
	// matcher.MatchList uses relative paths internally
	// and expects to be able to call Abs on them.
	s.cwd.MkdirAll(0700)
}

func (s *BundlerSuite) TestNewBundlerDirectory() {
	log := loggingtest.NewMockLogger()
	log.On("WithArgs", logging.LogKeyOp, events.PublishCreateBundleOp).Return(log)
	log.On("Info", mock.Anything)
	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)
	s.NotNil(bundler)
	log.AssertExpectations(s.T())
}

func (s *BundlerSuite) TestNewBundlerFile() {
	log := loggingtest.NewMockLogger()
	log.On("WithArgs", logging.LogKeyOp, events.PublishCreateBundleOp).Return(log)
	log.On("Info", mock.Anything)
	path := s.cwd.Join("app.py")
	err := path.WriteFile([]byte("import flask\napp=flask.Flask(__name)\n"), 0600)
	s.Nil(err)
	bundler, err := NewBundler(path, NewManifest(), nil, log)
	s.Nil(err)
	s.NotNil(bundler)
	log.AssertExpectations(s.T())
}

func (s *BundlerSuite) makeFile(path string) {
	s.makeFileWithContents(path, []byte("content of "+path))
}

func (s *BundlerSuite) makeFileWithContents(relPath string, contents []byte) {
	path := s.cwd.Join(relPath)
	err := path.Dir().MkdirAll(0700)
	s.Nil(err)

	err = path.WriteFile(contents, 0600)
	s.Nil(err)
}

func (s *BundlerSuite) TestCreateBundle() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	dest := new(bytes.Buffer)
	log := logging.New()

	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Len(manifest.Files, 2)
	// Manifest filenames are always Posix paths, not Windows paths
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest.GetFilenames())
	s.Equal([]string{
		"manifest.json",
		"subdir/",
		"subdir/testfile",
		"testfile",
	}, s.getTarFileNames(dest))
}

func (s *BundlerSuite) TestCreateBundleAutoDetect() {
	s.makeFileWithContents("app.py", []byte("import flask"))
	dest := new(bytes.Buffer)
	log := logging.New()

	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Len(manifest.Files, 1)
	s.Equal([]string{
		"app.py",
		"manifest.json",
	}, s.getTarFileNames(dest))
}

func (s *BundlerSuite) TestCreateBundleMissingDirectory() {
	path := util.NewAbsolutePath("/nonexistent", s.fs)
	log := logging.New()
	bundler, err := NewBundler(path, NewManifest(), nil, log)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleMissingFile() {
	log := logging.New()
	path := s.cwd.Join("nonexistent")
	bundler, err := NewBundler(path, NewManifest(), nil, log)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleWalkError() {
	log := logging.New()
	walker := bundlestest.NewMockWalker()
	testError := errors.New("test error from Walk")
	walker.On("Walk", mock.Anything, mock.Anything).Return(testError)

	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)
	s.NotNil(bundler)
	bundler.walker = walker

	dest := new(bytes.Buffer)
	manifest, err := bundler.CreateBundle(dest)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(manifest)
}

func (s *BundlerSuite) TestCreateBundleAddManifestError() {
	log := logging.New()
	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)
	s.NotNil(bundler)

	testError := errors.New("test error from Write")
	dest := utiltest.NewMockWriter()
	dest.On("Write", mock.Anything).Return(0, testError)

	manifest, err := bundler.CreateBundle(dest)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(manifest)
}

func (s *BundlerSuite) getTarFileNames(buf *bytes.Buffer) []string {
	unzipper, err := gzip.NewReader(buf)
	s.NoError(err)
	reader := tar.NewReader(unzipper)
	names := []string(nil)

	for {
		header, err := reader.Next()
		if err == io.EOF {
			// End of archive
			break
		}
		s.NoError(err)
		names = append(names, header.Name)
	}
	slices.Sort(names)
	return names
}

func (s *BundlerSuite) TestMultipleCallsFromDirectory() {
	// The bundler should be reusable for multiple
	// passes over the bundle directory.
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	log := logging.New()
	bundler, err := NewBundler(s.cwd, NewManifest(), nil, log)
	s.Nil(err)

	manifest, err := bundler.CreateBundle(io.Discard)
	s.Nil(err)
	s.NotNil(manifest)
	// Manifest filenames are always Posix paths, not Windows paths
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest.GetFilenames())

	dest := new(bytes.Buffer)
	manifest2, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest2)
	// Manifest filenames are always Posix paths, not Windows paths
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest2.GetFilenames())
	s.Equal([]string{
		"manifest.json",
		"subdir/",
		"subdir/testfile",
		"testfile",
	}, s.getTarFileNames(dest))
}

func (s *BundlerSuite) TestCreateBundleFromSubdirectory() {
	// Simulate a project in a subdirectory of the workspace.
	// The bundler should only include files from the subdirectory
	// with paths relative to that subdirectory.
	// Uses real OS directories because CreateBundle calls os.Chdir.
	osFs := afero.NewOsFs()
	tempDir, err := os.MkdirTemp("", "bundle_subdir_test_*")
	s.Nil(err)
	defer os.RemoveAll(tempDir)

	workspace := util.AbsolutePath{Path: util.NewPath(tempDir, osFs)}
	subdir := workspace.Join("myproject")
	err = subdir.MkdirAll(0700)
	s.Nil(err)

	// Create files in the subdirectory
	appPath := subdir.Join("app.py")
	err = appPath.WriteFile([]byte("import flask"), 0600)
	s.Nil(err)

	dataDir := subdir.Join("data")
	err = dataDir.MkdirAll(0700)
	s.Nil(err)
	dataFile := dataDir.Join("input.csv")
	err = dataFile.WriteFile([]byte("x,y\n1,2"), 0600)
	s.Nil(err)

	// Create a file in the parent (workspace root) that should NOT be included
	rootFile := workspace.Join("unrelated.txt")
	err = rootFile.WriteFile([]byte("should not appear"), 0600)
	s.Nil(err)

	dest := new(bytes.Buffer)
	log := logging.New()

	// Bundle from the subdirectory, not the workspace root
	bundler, err := NewBundler(subdir, NewManifest(), nil, log)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)

	filenames := manifest.GetFilenames()
	// Files should be relative to the subdirectory
	s.Contains(filenames, "app.py")
	s.Contains(filenames, "data/input.csv")
	// Workspace root files should not be included
	for _, f := range filenames {
		s.NotContains(f, "unrelated.txt")
		// Paths should not contain the subdirectory name as a prefix
		s.False(strings.HasPrefix(f, "myproject/"), "file path should be relative to subdirectory, not workspace root")
	}

	tarFiles := s.getTarFileNames(dest)
	s.Contains(tarFiles, "app.py")
	s.Contains(tarFiles, "data/")
	s.Contains(tarFiles, "data/input.csv")
	s.Contains(tarFiles, "manifest.json")
	// Workspace root file should not be in the tar
	s.NotContains(tarFiles, "unrelated.txt")
}

func (s *BundlerSuite) TestCreateBundleFromSubdirectoryWithFileTarget() {
	// When given a specific file in a subdirectory, the bundler
	// should use the file's parent as baseDir and include the file.
	// Uses real OS directories because CreateBundle calls os.Chdir.
	osFs := afero.NewOsFs()
	tempDir, err := os.MkdirTemp("", "bundle_subdir_file_test_*")
	s.Nil(err)
	defer os.RemoveAll(tempDir)

	subdir := util.AbsolutePath{Path: util.NewPath(filepath.Join(tempDir, "myproject"), osFs)}
	err = subdir.MkdirAll(0700)
	s.Nil(err)

	appPath := subdir.Join("app.py")
	err = appPath.WriteFile([]byte("import flask"), 0600)
	s.Nil(err)

	helperPath := subdir.Join("helpers.py")
	err = helperPath.WriteFile([]byte("def helper(): pass"), 0600)
	s.Nil(err)

	dest := new(bytes.Buffer)
	log := logging.New()

	// Bundle from a specific file in the subdirectory
	bundler, err := NewBundler(appPath, NewManifest(), nil, log)
	s.Nil(err)
	s.Equal(subdir.String(), bundler.baseDir.String())
	s.Equal("app.py", bundler.filename)

	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	filenames := manifest.GetFilenames()
	s.Contains(filenames, "app.py")
	s.Contains(filenames, "helpers.py")
}

func (s *BundlerSuite) TestNewBundleFromDirectorySymlinks() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := s.cwd.Join("testdata", "symlink_test", "bundle_dir").WithFs(fs)
	dest := new(bytes.Buffer)
	log := logging.New()

	bundler, err := NewBundler(dirPath, NewManifest(), nil, log)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	// Manifest filenames are always Posix paths, not Windows paths
	s.Equal([]string{
		"linked_dir/testfile",
		"linked_file",
		"somefile",
	}, manifest.GetFilenames())
	s.Equal([]string{
		"linked_dir/",
		"linked_dir/testfile",
		"linked_file",
		"manifest.json",
		"somefile",
	}, s.getTarFileNames(dest))
}

// We log the issues with symbolic links but not return them to not polute the user with error notifications
// when another piece of software is dealing with the same directory.
func (s *BundlerSuite) TestNewBundleFromDirectoryMissingSymlinkTarget() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := s.cwd.Join("testdata", "symlink_test", "link_target_missing").WithFs(fs)
	dest := new(bytes.Buffer)
	log := logging.New()

	bundler, err := NewBundler(dirPath, NewManifest(), nil, log)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.NoError(err)
	s.NotNil(manifest)
}
