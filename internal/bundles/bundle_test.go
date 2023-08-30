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
	"strings"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles/bundlestest"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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
	cwd      util.Path
	manifest *Manifest
}

func TestBundlerSuite(t *testing.T) {
	suite.Run(t, new(BundlerSuite))
}

func (s *BundlerSuite) SetupSuite() {
	// Our testdata/bundle_dir needs to contain a non-regular
	// file, but you can't check a fifo into git of course.
	tarPath := s.cwd.Join("testdata", "symlink_test", "fifo.tar")
	cmd := exec.Command("tar", "xvf", tarPath.Path())
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
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	s.cwd.MkdirAll(0700)

	s.manifest = NewManifest()
	s.manifest.Metadata.AppMode = apptypes.StaticMode
	s.manifest.Metadata.Entrypoint = "subdir/testfile"
}

func (s *BundlerSuite) TestNewBundlerDirectory() {
	logger := logging.DefaultLogger()
	bundler, err := NewBundler(s.cwd, NewManifest(), []string{"*.log"}, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerFile() {
	logger := logging.DefaultLogger()
	path := s.cwd.Join("app.py")
	err := path.WriteFile([]byte("import flask\napp=flask.Flask(__name)\n"), 0600)
	s.Nil(err)
	bundler, err := NewBundler(path, NewManifest(), nil, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerExcludedFile() {
	// Test a primary entrypoint that also matches the exclusions.
	// For example, deploying dir/index.ipynb with *.ipynb excluded
	// to deploy just one notebook out of a collection.
	logger := logging.DefaultLogger()
	path := s.cwd.Join("app.py")
	err := path.WriteFile([]byte("import flask\napp=flask.Flask(__name)\n"), 0600)
	s.Nil(err)
	bundler, err := NewBundler(path, NewManifest(), []string{"*.py"}, nil, logger)
	s.Nil(err)
	s.NotNil(bundler)
	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.Equal([]string{
		"app.py",
	}, manifest.GetFilenames())
}

func (s *BundlerSuite) TestNewBundlerWalkerErr() {
	logger := logging.DefaultLogger()
	bundler, err := NewBundler(s.cwd, NewManifest(), []string{"[Z-A]"}, nil, logger)
	s.NotNil(err)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestNewBundlerForManifest() {
	logger := logging.DefaultLogger()
	manifestPath := s.cwd.Join(ManifestFilename)
	err := s.manifest.WriteManifestFile(manifestPath)
	s.Nil(err)
	bundler, err := NewBundlerForManifestFile(manifestPath, logger)
	s.Nil(err)
	s.NotNil(bundler)
}

func (s *BundlerSuite) TestNewBundlerForManifestMissingManifestFile() {
	logger := logging.DefaultLogger()
	manifestPath := s.cwd.Join(ManifestFilename)
	bundler, err := NewBundlerForManifestFile(manifestPath, logger)
	s.NotNil(err)
	s.Nil(bundler)
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

	md5sum := md5.Sum(contents)
	s.manifest.AddFile(relPath, md5sum[:])
}

func (s *BundlerSuite) TestCreateBundle() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	bundler, err := NewBundler(s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Len(manifest.Files, 2)
}

func (s *BundlerSuite) TestCreateBundleAutoDetect() {
	s.makeFileWithContents("app.py", []byte("import flask"))
	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	bundler, err := NewBundler(s.cwd, NewManifest(), nil, nil, logger)
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
	logger := logging.DefaultLogger()

	bundler, err := NewBundler(s.cwd, manifest, nil, pythonRequirements, logger)
	s.Nil(err)
	dest := new(bytes.Buffer)
	manifestOut, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifestOut)
	s.Len(manifestOut.Files, 2)
}

func (s *BundlerSuite) TestCreateBundleMissingDirectory() {
	path := util.NewPath("/nonexistent", s.fs)
	logger := logging.DefaultLogger()
	bundler, err := NewBundler(path, NewManifest(), nil, nil, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleMissingFile() {
	logger := logging.DefaultLogger()
	path := s.cwd.Join("nonexistent")
	bundler, err := NewBundler(path, NewManifest(), nil, nil, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(bundler)
}

func (s *BundlerSuite) TestCreateBundleWalkError() {
	logger := logging.DefaultLogger()
	walker := bundlestest.NewMockWalker()
	testError := errors.New("test error from Walk")
	walker.On("Walk", mock.Anything, mock.Anything).Return(testError)

	bundler, err := NewBundler(s.cwd, NewManifest(), nil, nil, logger)
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
	logger := logging.DefaultLogger()
	bundler, err := NewBundler(s.cwd, NewManifest(), nil, nil, logger)
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

	logger := logging.DefaultLogger()
	bundler, err := NewBundler(s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest.GetFilenames())
}

func (s *BundlerSuite) TestMultipleCallsFromDirectory() {
	// The bundler should be reusable for multiple
	// passes over the bundle directory.
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	logger := logging.DefaultLogger()
	bundler, err := NewBundler(s.cwd, s.manifest, nil, nil, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest.GetFilenames())

	dest := new(bytes.Buffer)
	manifest2, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest2)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest2.GetFilenames())
}

func (s *BundlerSuite) TestMultipleCallsFromManifest() {
	// The bundler should be reusable for multiple
	// passes over the bundle directory.
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	logger := logging.DefaultLogger()
	manifestPath := s.cwd.Join(ManifestFilename)
	err := s.manifest.WriteManifestFile(manifestPath)
	s.Nil(err)
	bundler, err := NewBundlerForManifestFile(manifestPath, logger)
	s.Nil(err)

	manifest, err := bundler.CreateManifest()
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest.GetFilenames())

	dest := new(bytes.Buffer)
	manifest2, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest2)
	s.Equal([]string{
		"subdir/testfile",
		"testfile",
	}, manifest2.GetFilenames())
}

func (s *BundlerSuite) TestNewBundleFromManifest() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	manifestPath := s.cwd.Join(ManifestFilename)
	err := s.manifest.WriteManifestFile(manifestPath)
	s.Nil(err)

	bundler, err := NewBundlerForManifestFile(manifestPath, logger)
	s.Nil(err)
	manifestOut, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.Equal(s.manifest.GetFilenames(), manifestOut.GetFilenames())
	s.Greater(dest.Len(), 0)
}

func (s *BundlerSuite) TestNewBundleFromManifestMissingFile() {
	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	s.manifest.AddFile("nonexistent", []byte{0})
	manifestPath := s.cwd.Join(ManifestFilename)
	err := s.manifest.WriteManifestFile(manifestPath)
	s.Nil(err)

	bundler, err := NewBundlerForManifestFile(manifestPath, logger)
	s.Nil(err)
	manifestOut, err := bundler.CreateBundle(dest)
	s.NotNil(err)
	s.Nil(manifestOut)
	s.ErrorContains(err, "error adding file")
	s.ErrorIs(err, os.ErrNotExist)
}

func (s *BundlerSuite) TestNewBundleFromDirectorySymlinks() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := util.NewPath(s.cwd.Path(), fs).Join("testdata", "symlink_test", "bundle_dir")
	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	bundler, err := NewBundler(dirPath, NewManifest(), nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.Nil(err)
	s.NotNil(manifest)
	s.Equal([]string{
		"linked_dir/testfile",
		"linked_file",
		"somefile",
	}, manifest.GetFilenames())
}

func (s *BundlerSuite) TestNewBundleFromDirectoryMissingSymlinkTarget() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	fs := afero.NewOsFs()
	dirPath := util.NewPath(s.cwd.Path(), fs).Join("testdata", "symlink_test", "link_target_missing")
	dest := new(bytes.Buffer)
	logger := logging.DefaultLogger()

	bundler, err := NewBundler(dirPath, NewManifest(), nil, nil, logger)
	s.Nil(err)
	manifest, err := bundler.CreateBundle(dest)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(manifest)
}
