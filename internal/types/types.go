package types

import "time"

// Copyright (C) 2023 by Posit Software, PBC.

type GUID string
type Int64Str string
type Time = time.Time

type ContentName string
type ContentID string
type BundleID string
type TaskID string
type UserID string
type PrincipalID string

type NullString = Optional[string]
type NullInt32 = Optional[int32]
type NullInt64 = Optional[int64]
type NullFloat64 = Optional[float64]
type NullBool = Optional[bool]
type NullGUID = Optional[GUID]
type NullContentID = Optional[ContentID]
type NullBundleID = Optional[BundleID]
type NullInt64Str = Optional[Int64Str]
type NullTime = Optional[Time]
