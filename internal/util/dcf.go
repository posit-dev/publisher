package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type DCFRecord map[string]string
type DCFData []DCFRecord

const whitespace = " \t"

// ReadDCFFiles reads all of the .dcf files in the given directory,
// returning a single list of records containing the records
// from all of the files.
func ReadDCFFiles(pattern string) (DCFData, error) {
	records := DCFData{}
	paths, err := filepath.Glob(pattern)
	if err != nil {
		return records, err
	}

	for _, path := range paths {
		fileRecords, err := ReadDCFFile(path)
		if err != nil {
			return records, err
		}
		records = append(records, fileRecords...)
	}
	return records, nil
}

func ReadDCFFile(path string) (DCFData, error) {
	f, err := os.Open(path)
	if err != nil {
		return DCFData{}, err
	}
	defer f.Close()
	return ReadDCF(f)
}

func ReadDCF(r io.Reader) (DCFData, error) {
	fileScanner := bufio.NewScanner(r)
	records := DCFData{}
	currentRecord := DCFRecord{}
	currentTag := ""
	lineNum := 0

	for fileScanner.Scan() {
		line := fileScanner.Text()
		lineNum++

		trimmedLine := strings.TrimLeft(line, whitespace)
		if trimmedLine == "" {
			// Blank (whitespace-only) line indicates end of record
			records = append(records, currentRecord)
			currentRecord = DCFRecord{}
			currentTag = ""
		} else if trimmedLine != line {
			// Leading whitespace indicates a continuation line
			if currentTag == "" {
				return records, fmt.Errorf("Couldn't parse DCF data: unexpected continuation on line %d", lineNum)
			}
			currentRecord[currentTag] += strings.Trim(line, whitespace)
		} else {
			// New field in the current record
			tag, value, ok := strings.Cut(line, ":")
			if !ok {
				return records, fmt.Errorf("Couldn't parse DCF data: missing ':' on line %d", lineNum)
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
