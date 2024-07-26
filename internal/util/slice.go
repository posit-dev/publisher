package util

// Copyright (C) 2023 by Posit Software, PBC.

func RemoveDuplicates[T comparable](list []T) []T {
	seen := map[T]bool{}
	out := []T{}
	for _, item := range list {
		_, ok := seen[item]
		if !ok {
			seen[item] = true
			out = append(out, item)
		}
	}
	return out
}

func Map[T any](fn func(T) T, list []T) []T {
	out := make([]T, len(list))
	for i, item := range list {
		out[i] = fn(item)
	}
	return out
}
