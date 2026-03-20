package connect_cloud

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"encoding/json"
)

// redactFixture sanitizes sensitive fields in a fixture so that tokens and
// secrets are not committed to the repository.
func redactFixture(f *Fixture) {
	f.ResponseBody = redactJSONField(f.ResponseBody, "token", `"REDACTED"`)
	f.ResponseBody = redactJSONField(f.ResponseBody, "source_bundle_upload_url", `"https://REDACTED"`)
	f.RequestBody = redactSecrets(f.RequestBody)
}

// redactJSONField replaces the value of a top-level key in a JSON object with
// the given replacement (which should be a valid JSON value literal).
func redactJSONField(raw json.RawMessage, key string, replacement string) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}

	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}

	if _, ok := m[key]; !ok {
		return raw
	}

	m[key] = json.RawMessage(replacement)

	// Also recurse into nested objects (e.g. next_revision.source_bundle_upload_url).
	for k, v := range m {
		if k == key {
			continue
		}
		m[k] = redactJSONField(v, key, replacement)
	}

	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
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
