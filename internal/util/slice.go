package util

// Copyright (C) 2023 by Posit Software, PBC.

func Map[T any](fn func(T) T, list []T) []T {
	out := make([]T, len(list))
	for i, item := range list {
		out[i] = fn(item)
	}
	return out
}
