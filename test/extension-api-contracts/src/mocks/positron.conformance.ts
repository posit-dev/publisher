// Copyright (C) 2026 by Posit Software, PBC.

// Compile-time conformance check: validates that the positron mock's interfaces
// match the real Positron type declarations from extensions/vscode/src/@types/.
//
// Run:  npm run check:conformance
//   or: npx tsc --noEmit -p tsconfig.conformance.json
//
// The real Positron types come from the ambient module declaration at
// extensions/vscode/src/@types/positron.d.ts, which is included in
// tsconfig.conformance.json. Without the "positron" path alias, TypeScript
// resolves `import type from "positron"` to that ambient declaration.

import type {
  PositronApi as RealPositronApi,
  LanguageRuntimeMetadata as RealMetadata,
} from "positron";
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

// Note: acquirePositronApi() is exported by the mock but is not declared in the
// ambient positron.d.ts (it's a global function injected by the Positron runtime).
// It cannot be conformance-checked against types here.
