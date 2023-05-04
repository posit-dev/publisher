package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"bytes"
	"crypto/md5"
	"errors"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles/bundlestest"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
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

	fs       afero.Fs
	cwd      string
	manifest *Manifest
}

func TestBundlerSuite(t *testing.T) {
	suite.Run(t, new(BundlerSuite))
}

func (s *BundlerSuite) SetupSuite() {
	// Our testdata/bundle_dir needs to contain a non-regular
	// file, but you can't check a fifo into git of course.
	tarPath := filepath.Join(s.cwd, "testdata", "symlink_test", "fifo.tar")
	cmd := exec.Command("tar", "xvf", tarPath)
	err := cmd.Run()
	s.Nil(err)
}

func (s *BundlerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := os.Getwd()
	s.Nil(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewBundleFrom*
	// can Chdir there. This is needed because the
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	s.fs.MkdirAll(cwd, 0700)

	s.manifest = NewManifest()
	s.manifest.Metadata.AppMode = apptypes.StaticMode
	s.manifest.Metadata.Entrypoint = "subdir/testfile"
}

func (s *BundlerSuite) TestNewBundlerDirectory() {
	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, s.cwd, NewManifest(), []string{"*.log"}, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerFile() {
	logger := rslog.NewDiscardingLogger()
	path := filepath.Join(s.cwd, "app.py")
	err := afero.WriteFile(s.fs, path, []byte("import flask\napp=flask.Flask(__name)\n"), 0600)
	s.Nil(err)
	bundler, err := NewBundler(s.fs, path, NewManifest(), nil, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerExcludedFile() {
	// Test a primary entrypoint that also matches the exclusions.
	// For example, deploying dir/index.ipynb with *.ipynb excluded
	// to deploy just one notebook out of a collection.
	logger := rslog.NewDiscardingLogger()
	path := filepath.Join(s.cwd, "app.py")
	err := afero.WriteFile(s.fs, path, []byte("import flask\napp=flask.Flask(__name)\n"), 0600)
	s.Nil(err)
	bundler, err := NewBundler(s.fs, path, NewManifest(), []string{"*.py"}, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.Equal([]string{
		"app.py",
	}, getManifestFilenames(manifest))
}

func (s *BundlerSuite) TestNewBundlerWalkerErr() {
	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, s.cwd, NewManifest(), []string{"[Z-A]"}, nil, logger)
	s.NotNil(err)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestNewBundlerForManifest() {
	logger := rslog.NewDiscardingLogger()
	manifestPath := filepath.Join(s.cwd, ManifestFilename)
	err := s.manifest.WriteManifestFile(s.fs, manifestPath)
	s.Nil(err)
	bundler, err := NewBundlerForManifest(s.fs, manifestPath, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerForManifestMissingManifestFile() {
	logger := rslog.NewDiscardingLogger()
	manifestPath := filepath.Join(s.cwd, ManifestFilename)
	bundler, err := NewBundlerForManifest(s.fs, manifestPath, logger)
	s.NotNil(err)
	s.Nil(bundler)
}

func (s *BundlerSuite) makeFile(path string) {
	s.makeFileWithContents(path, []byte("content of "+path))
}

func (s *BundlerSuite) makeFileWithContents(path string, contents []byte) {
	path = filepath.Join(s.cwd, path)
	err := s.fs.MkdirAll(filepath.Dir(path), 0700)
	s.Nil(err)

	err = afero.WriteFile(s.fs, path, contents, 0600)
	s.Nil(err)

	md5sum := md5.Sum(contents)
	relPath, err := filepath.Rel(s.cwd, path)
	s.Nil(err)
	s.manifest.AddFile(relPath, md5sum[:])
}

func (s *BundlerSuite) TestCreateBundle() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	bundler, err := NewBundler(s.fs, s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Len(manifest.Files, 2)
}

func (s *BundlerSuite) TestCreateBundleAutoDetect() {
	s.makeFileWithContents("app.py", []byte("import flask"))
	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	bundler, err := NewBundler(s.fs, s.cwd, NewManifest(), nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Len(manifest.Files, 1)
}

func (s *BundlerSuite) TestCreateBundlePythonPackages() {
	s.makeFileWithContents("app.py", []byte("import flask"))
	manifest := NewManifest()
	manifest.Python = &Python{}
	pythonRequirements := []byte("flask\nnumpy")
	logger := rslog.NewDiscardingLogger()

	bundler, err := NewBundler(s.fs, s.cwd, manifest, nil, pythonRequirements, logger)
	s.Nil(err)
	dest := new(bytes.Buffer)
	manifestOut, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifestOut)
	s.Len(manifestOut.Files, 2)
}

func (s *BundlerSuite) TestCreateBundleMissingDirectory() {
	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, "nonexistent", NewManifest(), nil, nil, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleMissingFile() {
	logger := rslog.NewDiscardingLogger()
	path := filepath.Join(s.cwd, "nonexistent")
	bundler, err := NewBundler(s.fs, path, NewManifest(), nil, nil, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleWalkError() {
	logger := rslog.NewDiscardingLogger()
	walker := bundlestest.NewMockWalker()
	testError := errors.New("test error from Walk")
	walker.On("Walk", mock.Anything, mock.Anything).Return(testError)

	bundler, err := NewBundler(s.fs, s.cwd, NewManifest(), nil, nil, logger)
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
	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, s.cwd, NewManifest(), nil, nil, logger)
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

func (s *BundlerSuite) TestCreateManifest() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, getManifestFilenames(manifest))
}

func (s *BundlerSuite) TestMultipleCallsFromDirectory() {
	// The bundler should be reusable for multiple
	// passes over the bundle directory.
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	logger := rslog.NewDiscardingLogger()
	bundler, err := NewBundler(s.fs, s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, getManifestFilenames(manifest))

	dest := new(bytes.Buffer)
	manifest2, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest2)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, getManifestFilenames(manifest2))
}

func (s *BundlerSuite) TestMultipleCallsFromManifest() {
	// The bundler should be reusable for multiple
	// passes over the bundle directory.
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	logger := rslog.NewDiscardingLogger()
	manifestPath := filepath.Join(s.cwd, ManifestFilename)
	err := s.manifest.WriteManifestFile(s.fs, manifestPath)
	s.Nil(err)
	bundler, err := NewBundlerForManifest(s.fs, manifestPath, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, getManifestFilenames(manifest))

	dest := new(bytes.Buffer)
	manifest2, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest2)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, getManifestFilenames(manifest2))
}

func (s *BundlerSuite) TestNewBundleFromManifest() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	manifestPath := filepath.Join(s.cwd, "manifest.json")
	err := s.manifest.WriteManifestFile(s.fs, manifestPath)
	s.Nil(err)

	bundler, err := NewBundlerForManifest(s.fs, manifestPath, logger)
	s.Nil(err)
	manifestOut, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.Equal(getManifestFilenames(s.manifest), getManifestFilenames(manifestOut))
	s.Greater(dest.Len(), 0)
}

func (s *BundlerSuite) TestNewBundleFromManifestMissingFile() {
	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	s.manifest.AddFile("nonexistent", []byte{0})
	manifestPath := filepath.Join(s.cwd, "manifest.json")
	err := s.manifest.WriteManifestFile(s.fs, manifestPath)
	s.Nil(err)

	bundler, err := NewBundlerForManifest(s.fs, manifestPath, logger)
	s.Nil(err)
	manifestOut, err := bundler.CreateBundle(dest)
	s.NotNil(err)
	s.Nil(manifestOut)
	s.ErrorContains(err, "Error adding file")
	s.ErrorIs(err, os.ErrNotExist)
}

func (s *BundlerSuite) TestNewBundleFromDirectorySymlinks() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := filepath.Join(s.cwd, "testdata", "symlink_test", "bundle_dir")
	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	bundler, err := NewBundler(fs, dirPath, NewManifest(), nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"linked_dir/testfile",
		"linked_file",
		"somefile",
	}, getManifestFilenames(manifest))
}

func (s *BundlerSuite) TestNewBundleFromDirectoryMissingSymlinkTarget() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := filepath.Join(s.cwd, "testdata", "symlink_test", "link_target_missing")
	dest := new(bytes.Buffer)
	logger := rslog.NewDiscardingLogger()

	bundler, err := NewBundler(fs, dirPath, NewManifest(), nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(manifest)
}

func getManifestFilenames(m *Manifest) []string {
	names := []string{}
	for name := range m.Files {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
