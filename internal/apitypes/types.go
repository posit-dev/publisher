package apitypes

import "time"

// Copyright (C) 2023 by Posit Software, PBC.

type GUID string
type Int64Str string
type Time = time.Time

type NullString = Optional[string]
type NullInt32 = Optional[int32]
type NullInt64 = Optional[int64]
type NullFloat64 = Optional[float64]
type NullGUID = Optional[GUID]
type NullInt64Str = Optional[Int64Str]
type NullTime = Optional[Time]
