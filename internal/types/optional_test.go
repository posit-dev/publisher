package types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type OptionalSuite struct {
	utiltest.Suite
}

func TestOptionalSuite(t *testing.T) {
	suite.Run(t, new(OptionalSuite))
}

func (s *OptionalSuite) TestNewOptional() {
	var opt NullString = NewOptional[string]("abc")
	value, ok := opt.Get()
	s.True(ok)
	s.Equal("abc", value)
}

func (s *OptionalSuite) TestNewOptionalEmptyString() {
	var opt NullString = NewOptional[string]("")
	value, ok := opt.Get()
	s.True(ok)
	s.Equal("", value)
}

func (s *OptionalSuite) TestOptionalZeroValue() {
	var opt NullString
	value, ok := opt.Get()
	s.Equal(ok, false)
	s.Equal("", value)
}

type optionalData struct {
	S      NullString   `json:"s"`
	I32    NullInt32    `json:"i32"`
	I64    NullInt64    `json:"i64"`
	F64    NullFloat64  `json:"f64"`
	Guid   NullGUID     `json:"guid"`
	I64str NullInt64Str `json:"i64str"`
	T      NullTime     `json:"t"`
}

func (s *OptionalSuite) TestUnmarshalJSONNotNull() {
	var data optionalData
	jsonInput := []byte(`{
		"s": "abc",
		"i32": 123,
		"i64": 456,
		"f64": 3.14159,
		"guid": "a-bad-1dea",
		"i64str": "8878273897198738917",
		"t": "2023-03-20T15:05:17-04:00"
	}`)
	err := json.Unmarshal(jsonInput, &data)
	s.Nil(err)

	ts, err := time.Parse(time.RFC3339Nano, "2023-03-20T15:05:17-04:00")
	s.Nil(err)

	s.Equal(data, optionalData{
		S:      NewOptional[string]("abc"),
		I32:    NewOptional[int32](123),
		I64:    NewOptional[int64](456),
		F64:    NewOptional[float64](3.14159),
		Guid:   NewOptional[GUID]("a-bad-1dea"),
		I64str: NewOptional[Int64Str]("8878273897198738917"),
		T:      NewOptional[Time](ts),
	})

	str, ok := data.S.Get()
	s.True(ok)
	s.Equal("abc", str)
	i32, ok := data.I32.Get()
	s.True(ok)
	s.Equal(int32(123), i32)
	i64, ok := data.I64.Get()
	s.True(ok)
	s.Equal(int64(456), i64)
	f64, ok := data.F64.Get()
	s.True(ok)
	s.Equal(3.14159, f64)
	guid, ok := data.Guid.Get()
	s.True(ok)
	s.Equal(GUID("a-bad-1dea"), guid)
	i64str, ok := data.I64str.Get()
	s.Equal(Int64Str("8878273897198738917"), i64str)
	s.True(ok)
	gotTS, ok := data.T.Get()
	s.Equal(ts, gotTS)
	s.True(ok)
}

func (s *OptionalSuite) TestUnmarshalJSONAllNull() {
	var data optionalData
	jsonInput := []byte(`{
		"s": null,
		"i32": null,
		"i64": null,
		"f64": null,
		"guid": null,
		"i64str": null,
		"t": null
	}`)
	err := json.Unmarshal(jsonInput, &data)
	s.Nil(err)

	s.Equal(data, optionalData{})

	var ok bool
	_, ok = data.S.Get()
	s.False(ok)
	_, ok = data.I32.Get()
	s.False(ok)
	_, ok = data.I64.Get()
	s.False(ok)
	_, ok = data.F64.Get()
	s.False(ok)
	_, ok = data.Guid.Get()
	s.False(ok)
	_, ok = data.I64str.Get()
	s.False(ok)
	_, ok = data.T.Get()
	s.False(ok)
}

func (s *OptionalSuite) TestMarshalJSONNotNull() {
	ts, err := time.Parse(time.RFC3339Nano, "2023-03-20T15:05:17-04:00")
	s.Nil(err)

	data := optionalData{
		S:      NewOptional[string]("abc"),
		I32:    NewOptional[int32](123),
		I64:    NewOptional[int64](456),
		F64:    NewOptional[float64](3.14159),
		Guid:   NewOptional[GUID]("a-bad-1dea"),
		I64str: NewOptional[Int64Str]("8878273897198738917"),
		T:      NewOptional[Time](ts),
	}
	jsonOutput, err := json.Marshal(&data)
	s.Nil(err)

	s.Equal([]byte(`{"s":"abc","i32":123,"i64":456,"f64":3.14159,"guid":"a-bad-1dea","i64str":"8878273897198738917","t":"2023-03-20T15:05:17-04:00"}`), jsonOutput)
}

func (s *OptionalSuite) TestMarshalJSONAllNull() {
	data := optionalData{}
	jsonOutput, err := json.Marshal(&data)
	s.Nil(err)
	expected := []byte(`{"s":null,"i32":null,"i64":null,"f64":null,"guid":null,"i64str":null,"t":null}`)
	s.Equal(expected, jsonOutput)
}

func (s *OptionalSuite) TestUnmarshalJSONErr() {
	var data optionalData
	jsonInput := []byte(`{
		"t": "foo"
	}`)
	err := json.Unmarshal(jsonInput, &data)
	s.NotNil(err)
}

func (s *OptionalSuite) TestNotValid() {
	var value Optional[string]
	s.Equal(value.Valid(), false)
}

func (s *OptionalSuite) TestValid() {
	value := NewOptional("hi there")
	s.Equal(value.Valid(), true)
}

func (s *OptionalSuite) TestValidEmpty() {
	value := NewOptional("")
	s.Equal(value.Valid(), true)
}
