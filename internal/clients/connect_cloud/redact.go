package connect_cloud

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"regexp"
)

// GUIDMap tracks the mapping of real GUIDs to fake ones so that cross-references
// between fixtures remain consistent.
type GUIDMap struct {
	mapping map[string]string
	counter int
}

func NewGUIDMap() *GUIDMap {
	return &GUIDMap{mapping: make(map[string]string)}
}

func (g *GUIDMap) replace(real string) string {
	if fake, ok := g.mapping[real]; ok {
		return fake
	}
	g.counter++
	fake := fmt.Sprintf("00000000-0000-0000-0000-%012d", g.counter)
	g.mapping[real] = fake
	return fake
}

var guidPattern = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// redactFixture sanitizes sensitive fields in a fixture so that tokens,
// secrets, PII, and real GUIDs are not committed to the repository.
func redactFixture(f *Fixture, guids *GUIDMap) {
	f.ResponseBody = redactJSONField(f.ResponseBody, "token", `"REDACTED"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "source_bundle_upload_url", `"https://REDACTED"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "email", `"redacted@example.com"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "avatar_url", `"https://REDACTED"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "github_avatar_url", `"https://REDACTED"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "name", `"redacted-user"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "display_name", `"Redacted User"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "social_handles", `[]`)
	f.RequestBody = redactSecrets(f.RequestBody)

	// Replace all GUIDs consistently across request and response bodies and path.
	f.Path = redactGUIDs(f.Path, guids)
	f.Query = redactGUIDs(f.Query, guids)
	f.RequestBody = redactGUIDsInJSON(f.RequestBody, guids)
	f.ResponseBody = redactGUIDsInJSON(f.ResponseBody, guids)
}

// redactGUIDs replaces all GUIDs in a plain string using the shared map.
func redactGUIDs(s string, guids *GUIDMap) string {
	return guidPattern.ReplaceAllStringFunc(s, guids.replace)
}

// redactGUIDsInJSON replaces all GUIDs in a JSON raw message using the shared map.
func redactGUIDsInJSON(raw json.RawMessage, guids *GUIDMap) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	replaced := guidPattern.ReplaceAllStringFunc(string(raw), guids.replace)
	return json.RawMessage(replaced)
}

// redactJSONField recursively replaces the value of a named key in a JSON
// object or array (at any nesting depth) with the given replacement literal.
func redactJSONField(raw json.RawMessage, key string, replacement string) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}

	// Try as object first.
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err == nil {
		changed := false

		if _, ok := m[key]; ok {
			m[key] = json.RawMessage(replacement)
			changed = true
		}

		for k, v := range m {
			if k == key {
				continue
			}
			redacted := redactJSONField(v, key, replacement)
			if string(redacted) != string(v) {
				m[k] = redacted
				changed = true
			}
		}

		if !changed {
			return raw
		}
		out, err := json.Marshal(m)
		if err != nil {
			return raw
		}
		return out
	}

	// Try as array.
	var arr []json.RawMessage
	if err := json.Unmarshal(raw, &arr); err == nil {
		changed := false
		for i, elem := range arr {
			redacted := redactJSONField(elem, key, replacement)
			if string(redacted) != string(elem) {
				arr[i] = redacted
				changed = true
			}
		}
		if !changed {
			return raw
		}
		out, err := json.Marshal(arr)
		if err != nil {
			return raw
		}
		return out
	}

	return raw
}

// redactSecrets replaces "value" fields inside a "secrets" array with "REDACTED".
func redactSecrets(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}

	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}

	secretsRaw, ok := m["secrets"]
	if !ok {
		return raw
	}

	var secrets []map[string]json.RawMessage
	if err := json.Unmarshal(secretsRaw, &secrets); err != nil {
		return raw
	}

	for i := range secrets {
		if _, hasValue := secrets[i]["value"]; hasValue {
			secrets[i]["value"] = json.RawMessage(`"REDACTED"`)
		}
	}

	redacted, err := json.Marshal(secrets)
	if err != nil {
		return raw
	}
	m["secrets"] = redacted

	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}
