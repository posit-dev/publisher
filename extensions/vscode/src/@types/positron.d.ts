// Copyright (C) 2024 by Posit Software, PBC.

// This is the portion of the Positron API definition
// used by Publisher, here until it is published.

declare module "positron" {
  export interface PositronApi {
    version: string;
    runtime: runtime;
  }

  /**
   * LanguageRuntimeMetadata contains information about a language runtime that is known
   * before the runtime is started.
   */
  export interface LanguageRuntimeMetadata {
    /** The path to the runtime. */
    runtimePath: string;

    /** A unique identifier for this runtime; takes the form of a GUID */
    runtimeId: string;

    /**
     * The fully qualified name of the runtime displayed to the user; e.g. "R 4.2 (64-bit)".
     * Should be unique across languages.
     */
    runtimeName: string;

    /**
     * A language specific runtime name displayed to the user; e.g. "4.2 (64-bit)".
     * Should be unique within a single language.
     */
    runtimeShortName: string;

    /** The version of the runtime itself (e.g. kernel or extension version) as a string; e.g. "0.1" */
    runtimeVersion: string;

    /** The runtime's source or origin; e.g. PyEnv, System, Homebrew, Conda, etc. */
    runtimeSource: string;

    /** The free-form, user-friendly name of the language this runtime can execute; e.g. "R" */
    languageName: string;

    /**
     * The Visual Studio Code Language ID of the language this runtime can execute; e.g. "r"
     *
     * See here for a list of known language IDs:
     * https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers
     */
    languageId: string;

    /** The version of the language; e.g. "4.2" */
    languageVersion: string;

    /** The Base64-encoded icon SVG for the language. */
    base64EncodedIconSvg: string | undefined;

    /** Whether the runtime should start up automatically or wait until explicitly requested */
    // startupBehavior: LanguageRuntimeStartupBehavior;

    /** Where sessions will be located; used as a hint to control session restoration */
    // sessionLocation: LanguageRuntimeSessionLocation;

    /**
     * Extra data supplied by the runtime provider; not read by Positron but supplied
     * when creating a new session from the metadata.
     */
    extraRuntimeData: any;
  }

  export interface runtime {
    getPreferredRuntime(languageId: string): Thenable<LanguageRuntimeMetadata>;
  }
}
