package api

// Copyright (C) 2023 by Posit Software, PBC.

type Links struct {
	Self References `json:"self"`
}

type References struct {
	HREF string `json:"href"`
}
