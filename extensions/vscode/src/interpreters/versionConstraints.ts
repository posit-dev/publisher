// Copyright (C) 2025 by Posit Software, PBC.

const pep440Operators = /(==|!=|<=|>=|~=|<|>)/;
const validVersion = /^\d+(\.\d+)*(\.\*)?$/;

/**
 * Adapts a raw Python version string from `.python-version` into a PEP 440
 * constraint suitable for deployment. Returns the adapted constraint string
 * or an empty string if the input is invalid.
 */
export function adaptPythonRequires(raw: string): string | null {
  const constraint = raw.trim();

  if (!constraint) {
    return null;
  }

  if (/[-/@]/.test(constraint)) {
    return null;
  }
  if (
    constraint.includes("rc") ||
    constraint.includes("b") ||
    constraint.includes("a")
  ) {
    return null;
  }

  const dotCount = (constraint.match(/\./g) || []).length;
  if (dotCount > 2) {
    return null;
  }

  // If it's already a PEP 440 constraint, return it as is
  if (pep440Operators.test(constraint)) {
    return constraint;
  }

  // Otherwise it should be a version string
  if (!validVersion.test(constraint)) {
    return null;
  }

  // If the version has a wildcard, use equivalence
  // e.g. 3.8.* -> ==3.8.*
  if (constraint.includes("*")) {
    return "==" + constraint;
  }

  return adaptToCompatibleConstraint(constraint);
}

/**
 * Converts a bare version string into a compatible release constraint (~=).
 * - "3" -> "~=3.0"
 * - "3.8" -> "~=3.8.0"
 * - "3.8.11" -> "~=3.8.0"
 */
export function adaptToCompatibleConstraint(constraint: string): string {
  const parts = constraint.split(".");
  if (parts.length === 1) {
    return `~=${parts[0]}.0`;
  }
  return `~=${parts[0]}.${parts[1]}.0`;
}
