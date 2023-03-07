package apitypes

import "time"

// Copyright (C) 2023 by Posit Software, PBC.

type GUID string
type Int64Str string
type Time struct {
	time.Time
}

type NullString struct {
	Optional[string]
}
type NullInt32 struct {
	Optional[int32]
}
type NullInt64 struct {
	Optional[int64]
}
type NullFloat64 struct {
	Optional[float64]
}
type NullGUID struct {
	Optional[GUID]
}
type NullInt64Str struct {
	Optional[Int64Str]
}
type NullTime struct {
	Optional[Time]
}

func NewNullString(value string) NullString {
	return NullString{NewOptional(value)}
}

func NewNullInt32(value int32) NullInt32 {
	return NullInt32{NewOptional(value)}
}

func NewNullInt64(value int64) NullInt64 {
	return NullInt64{NewOptional(value)}
}

func NewNullFloat64(value float64) NullFloat64 {
	return NullFloat64{NewOptional(value)}
}

func NewNullTime(value Time) NullTime {
	return NullTime{NewOptional(value)}
}

func NewNullGUID(value GUID) NullGUID {
	return NullGUID{NewOptional(value)}
}

func NewNullInt64Str(value Int64Str) NullInt64Str {
	return NullInt64Str{NewOptional(value)}
}
