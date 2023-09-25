package services

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/util"
)

type LocalToken string

func NewLocalToken() (LocalToken, error) {
	str, err := util.RandomString(32)
	if err != nil {
		return LocalToken(""), err
	}
	return LocalToken(str), nil
}
