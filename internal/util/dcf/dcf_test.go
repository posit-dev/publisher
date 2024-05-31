package dcf

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"os"
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	r := NewFileReader(nil)
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

	r := NewFileReader(nil)
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
	r := NewFileReader(nil)

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

	r := NewFileReader(nil)

	records, err := r.ReadFiles(path, "*.dcf")
	s.NotNil(err)
	s.Nil(records)
}

func (s *DCFSuite) TestDecode() {
	input := "a: 1\nb: 2\n\na: 3\nb: 4\n\ns: abc\n  def \n\nt: \n  ghi"
	expectedRecords := Records{
		{"a": "1", "b": "2"},
		{"a": "3", "b": "4"},
		{"s": "abc\ndef"},
		{"t": "ghi"},
	}
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder(nil)
	records, err := decoder.Decode(r)
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestDecodeKeepWhiteWithFollowingField() {
	input := "s: abc \n  def \nt: abc \n  def "
	expectedRecords := Records{
		{"s": "abc \n  def", "t": "abc\ndef"},
	}
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder([]string{"s"})
	records, err := decoder.Decode(r)
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestDecodeKeepWhiteLastFieldInRecord() {
	input := "t: abc\n  def \ns: abc\n  def \n\na: 1"
	expectedRecords := Records{
		{"s": "abc\n  def", "t": "abc\ndef"},
		{"a": "1"},
	}
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder([]string{"s"})
	records, err := decoder.Decode(r)
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestDecodeKeepWhiteLastFieldInLastRecord() {
	input := "t: abc\n  def \ns: abc\n  def "
	expectedRecords := Records{
		{"s": "abc\n  def", "t": "abc\ndef"},
	}
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder([]string{"s"})
	records, err := decoder.Decode(r)
	s.Nil(err)
	s.Equal(expectedRecords, records)
}

func (s *DCFSuite) TestDecodeMissingTag() {
	input := "a: 1\nabc"
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder(nil)
	records, err := decoder.Decode(r)
	s.ErrorContains(err, "missing ':'")
	s.Nil(records)
}

func (s *DCFSuite) TestDecodeUnexpectedContinuation() {
	input := "a: 1\n\n  def"
	r := bytes.NewReader([]byte(input))
	decoder := NewDecoder(nil)
	records, err := decoder.Decode(r)
	s.ErrorContains(err, "unexpected continuation")
	s.Nil(records)
}
