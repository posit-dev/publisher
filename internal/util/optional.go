package util

import "github.com/posit-dev/publisher/internal/types"

func AssignStrIfAvailable(target *string, source *types.Optional[string]) {
	value, valid := source.Get()
	if valid {
		*target = value
	}
}

func AssignBoolIfAvailable(target *bool, source *types.Optional[bool]) {
	value, valid := source.Get()
	if valid {
		*target = value
	}
}

func AssignInt32IfAvailable(target *int32, source *types.Optional[int32]) {
	value, valid := source.Get()
	if valid {
		*target = value
	}
}

func AssignInt64IfAvailable(target *int64, source *types.Optional[int64]) {
	value, valid := source.Get()
	if valid {
		*target = value
	}
}

func AssignFloat64IfAvailable(target *float64, source *types.Optional[float64]) {
	value, valid := source.Get()
	if valid {
		*target = value
	}
}
