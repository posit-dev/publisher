package dcf

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"github.com/rstudio/publishing-client/internal/util"
)

type Record map[string]string
type Records []Record

type Decoder interface {
	Decode(r io.Reader) (Records, error)
}

type FileReader interface {
	ReadFile(path util.Path) (Records, error)
	ReadFiles(path util.Path, pattern string) (Records, error)
}

type decoder struct{}

var _ Decoder = &decoder{}

type fileReader struct {
	decoder Decoder
}

var _ FileReader = &fileReader{}

func NewFileReader() *fileReader {
	return &fileReader{
		decoder: NewDecoder(),
	}
}

func NewDecoder() *decoder {
	return &decoder{}
}

const whitespace = " \t"

// ReadFiles reads all of the .dcf files in the given directory,
// returning a single list of records containing the records
// from all of the files.
func (r *fileReader) ReadFiles(path util.Path, pattern string) (Records, error) {
	paths, err := path.Glob(pattern)
	if err != nil {
		return nil, err
	}

	records := Records{}
	for _, path := range paths {
		fileRecords, err := r.ReadFile(path)
		if err != nil {
			return nil, err
		}
		records = append(records, fileRecords...)
	}
	return records, nil
}

func (r *fileReader) ReadFile(path util.Path) (Records, error) {
	f, err := path.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return r.decoder.Decode(f)
}

func (d *decoder) Decode(r io.Reader) (Records, error) {
	fileScanner := bufio.NewScanner(r)
	records := Records{}
	currentRecord := Record{}
	currentTag := ""
	lineNum := 0

	for fileScanner.Scan() {
		line := fileScanner.Text()
		lineNum++

		trimmedLine := strings.TrimLeft(line, whitespace)
		if trimmedLine == "" && len(currentRecord) != 0 {
			// Blank (whitespace-only) line indicates end of record
			records = append(records, currentRecord)
			currentRecord = Record{}
			currentTag = ""
		} else if trimmedLine != line {
			// Leading whitespace indicates a continuation line
			if currentTag == "" {
				return nil, fmt.Errorf("couldn't parse DCF data: unexpected continuation on line %d", lineNum)
			}
			currentRecord[currentTag] += strings.Trim(line, whitespace)
		} else {
			// New field in the current record
			tag, value, ok := strings.Cut(line, ":")
			if !ok {
				return nil, fmt.Errorf("couldn't parse DCF data: missing ':' on line %d", lineNum)
			}
			currentRecord[tag] = strings.Trim(value, whitespace)
			currentTag = tag
		}
	}
	// Include last record (if it wasn't followed by a blank line before EOF)
	if len(currentRecord) != 0 {
		records = append(records, currentRecord)
	}
	return records, nil
}
