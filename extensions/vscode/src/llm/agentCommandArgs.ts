// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Positron's agent-command dispatch does not consistently use one calling
 * convention for `posit.publisher.agent.*` commands: the model sometimes
 * invokes with a single object argument keyed by the declared `agent.args`
 * names, and sometimes with the same values spread positionally in that
 * order instead — confirmed from real tool calls where the *same* command
 * (`deployContent`) was invoked both ways within one session, and the
 * positional call silently dropped every argument because it was handled
 * as if it were the object form. Normalize either shape into the object
 * `run()` expects.
 */
export function normalizeAgentCommandArgs<T extends object>(
  raw: unknown[],
  argNames: readonly string[],
): Partial<T> {
  const first = raw[0];
  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return first as Partial<T>;
  }

  const input: Record<string, unknown> = {};
  argNames.forEach((name, index) => {
    if (raw[index] !== undefined) {
      input[name] = raw[index];
    }
  });
  return input as Partial<T>;
}
