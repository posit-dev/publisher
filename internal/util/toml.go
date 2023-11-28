package util

import (
	"fmt"
	"io"

	"github.com/pelletier/go-toml/v2"
)

func ReadTOML(r io.Reader, dest any) error {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	return dec.Decode(dest)
}

func ReadTOMLFile(path Path, dest any) error {
	f, err := path.Open()
	if err != nil {
		return err
	}
	defer f.Close()
	err = ReadTOML(f, dest)
	if err != nil {
		decodeErr, ok := err.(*toml.DecodeError)
		if ok {
			return fmt.Errorf("can't load file '%s': %s", path, decodeErr.String())
		}
		strictErr, ok := err.(*toml.StrictMissingError)
		if ok {
			return fmt.Errorf("can't load file '%s': \n%s", path, strictErr.String())
		}
		return err
	}
	return nil
}
