// Copyright (C) 2025 by Posit Software, PBC.

/**
 * Look-up an enum's key from an enum's value
 * 
 * @param myEnum <T> the enum
 * @param enumValue <string> the enum's value to look up the key
 *
 * @returns <keyof T | null> - the enum's key or null when the key is not found
 */
export const getEnumKeyByEnumValue = <T extends Record<string, string>>(myEnum: T, enumValue: string): keyof T | null => {
  const keys = Object.keys(myEnum).filter(x => myEnum[x] === enumValue);
  return keys.length ? keys[0] : null;
};
