package dcf

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bufio"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/util"
)

type Record map[string]string
type Records []Record

type Decoder interface {
	Decode(r io.Reader) (Records, error)
}

type FileReader interface {
	ReadFile(path util.AbsolutePath) (Records, error)
}

type decoder struct {
	keepWhite []string
}

var _ Decoder = &decoder{}

type fileReader struct {
	decoder Decoder
}

var _ FileReader = &fileReader{}

func NewFileReader(keepWhite []string) *fileReader {
	return &fileReader{
		decoder: NewDecoder(keepWhite),
	}
}

func NewDecoder(keepWhite []string) *decoder {
	return &decoder{
		keepWhite: keepWhite,
	}
}

const whitespace = " \t"

func (r *fileReader) ReadFile(path util.AbsolutePath) (Records, error) {
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
			currentRecord[currentTag] = strings.TrimRight(currentRecord[currentTag], whitespace)
			records = append(records, currentRecord)
			currentRecord = Record{}
			currentTag = ""
		} else if trimmedLine != line {
			// Leading whitespace indicates a continuation line
			if currentTag == "" {
				return nil, fmt.Errorf("couldn't parse DCF data: unexpected continuation on line %d", lineNum)
			}
			if !slices.Contains(d.keepWhite, currentTag) {
				line = strings.Trim(line, whitespace)
			}
			if currentRecord[currentTag] != "" {
				currentRecord[currentTag] += "\n"
			}
			currentRecord[currentTag] += line
		} else {
			// New field in the current record
			tag, value, ok := strings.Cut(line, ":")
			if !ok {
				return nil, fmt.Errorf("couldn't parse DCF data: missing ':' on line %d", lineNum)
			}

			// Trim end of current record value if needed
			if len(currentRecord) != 0 {
				currentRecord[currentTag] = strings.TrimRight(currentRecord[currentTag], whitespace)
			}

			if !slices.Contains(d.keepWhite, tag) {
				value = strings.TrimRight(value, whitespace)
			}
			currentRecord[tag] = strings.TrimLeft(value, whitespace)
			currentTag = tag
		}
	}
	// Include last record (if it wasn't followed by a blank line before EOF)
	if len(currentRecord) != 0 {
		currentRecord[currentTag] = strings.TrimRight(currentRecord[currentTag], whitespace)
		records = append(records, currentRecord)
	}
	return records, nil
}
