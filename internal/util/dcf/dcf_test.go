package dcf

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type DCFSuite struct {
	utiltest.Suite
}

func TestDCFSuite(t *testing.T) {
	suite.Run(t, new(DCFSuite))
}

func (s *DCFSuite) TestReadFile() {
	f := utiltest.NewMockFile()
	f.On("Close").Return(nil)

	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(f, nil)

	expectedRecords := Records{}
	r := NewFileReader()
	decoder := NewMockDecoder()
	decoder.On("Decode", mock.Anything).Return(expectedRecords, nil)
	r.decoder = decoder

	path := util.NewAbsolutePath("/nonexistent.dcf", fs)
	records, err := r.ReadFile(path)
	s.Nil(err)
	s.Equal(records, expectedRecords)
}

func (s *DCFSuite) TestReadFileNonexistent() {
	fs := utiltest.NewMockFs()
	fs.On("Open", mock.Anything).Return(nil, os.ErrNotExist)

	r := NewFileReader()
	path := util.NewAbsolutePath("/nonexistent.dcf", fs)
	data, err := r.ReadFile(path)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(data)
}

func (s *DCFSuite) TestReadFiles() {
	fs := afero.NewMemMapFs()
	path, err := util.Getwd(fs)
	s.NoError(err)

	err = path.Join("a.dcf").WriteFile([]byte(`a: 1`), 0600)
	s.NoError(err)
	err = path.Join("b.dcf").WriteFile([]byte(`b: 2`), 0600)
	s.NoError(err)
	err = path.Join("c.txt").WriteFile([]byte(`c: 3`), 0600)
	s.NoError(err)

	expectedRecords := Records{
		{"a": "1"},
		{"b": "2"},
	}
	r := NewFileReader()

	records, err := r.ReadFiles(path, "*.dcf")
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestReadFilesErr() {
	fs := afero.NewMemMapFs()
	path, err := util.Getwd(fs)
	s.NoError(err)

	err = path.Join("a.dcf").WriteFile([]byte(`abc`), 0600)
	s.NoError(err)

	r := NewFileReader()

	records, err := r.ReadFiles(path, "*.dcf")
	s.NotNil(err)
	s.Nil(records)
}

func (s *DCFSuite) TestDecode() {
	input := "a: 1\nb: 2\n\na: 3\nb: 4\n\ns: abc\n  def"
	expectedRecords := Records{
		{"a": "1", "b": "2"},
		{"a": "3", "b": "4"},
		{"s": "abcdef"},
	}
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder()
	records, err := decoder.Decode(r)
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestDecodeMissingColor() {
	input := "a: 1\nabc"
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder()
	records, err := decoder.Decode(r)
	s.ErrorContains(err, "missing ':'")
	s.Nil(records)
}

func (s *DCFSuite) TestDecodeUnexpectedContinuation() {
	input := "a: 1\n\n  def"
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder()
	records, err := decoder.Decode(r)
	s.ErrorContains(err, "unexpected continuation")
	s.Nil(records)
}
