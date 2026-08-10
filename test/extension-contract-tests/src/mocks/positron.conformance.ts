// Copyright (C) 2026 by Posit Software, PBC.

// Compile-time conformance check: validates that the positron mock's interfaces
// match the real Positron type declarations.
//
// Run:  npm run check:conformance
//   or: cd test/extension-contract-tests && npm run check:conformance
//
// The real Positron types come from the published @posit-dev/positron package,
// the same package the extension imports.

import type {
  PositronApi as RealPositronApi,
  LanguageRuntimeMetadata as RealMetadata,
} from "@posit-dev/positron";
import type {
  PositronApi as MockPositronApi,
  LanguageRuntimeMetadata as MockMetadata,
} from "./positron";

// ---------------------------------------------------------------------------
// Interface key checks
// ---------------------------------------------------------------------------
// Verify that every key in the mock interfaces exists in the real declarations.

type _Api = Pick<RealPositronApi, keyof MockPositronApi>;
type _Metadata = Pick<RealMetadata, keyof MockMetadata>;

// ---------------------------------------------------------------------------
// Acquisition helper check
// ---------------------------------------------------------------------------
// The mock injects acquirePositronApi as a global, exactly as Positron does at
// runtime. @posit-dev/positron declares that global and its
// tryAcquirePositronApi() helper — which the extension calls — reads it. Verify
// the mock's stand-in is callable the same way: no arguments.
//
// The return types are deliberately not compared: the real global resolves to
// the entire "positron" module namespace, while the mock models only the slice
// Publisher uses (checked above).

// Fails to compile unless T is exactly `true`.
type Assert<T extends true> = T;

type _RealGlobalAcquire = NonNullable<typeof acquirePositronApi>;
type _MockAcquire = typeof import("./positron").acquirePositronApi;

type _AcquireTakesNoArgs = Assert<
  [Parameters<_RealGlobalAcquire>, Parameters<_MockAcquire>] extends [[], []]
    ? true
    : false
>;
