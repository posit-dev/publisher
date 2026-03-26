// Copyright (C) 2026 by Posit Software, PBC.

import {
  detectPythonInterpreter,
  PythonInterpreterConfig,
} from "./pythonInterpreter";
import { detectRInterpreter, RInterpreterConfig } from "./rInterpreter";

export interface InterpreterDetectionResult {
  python: PythonInterpreterConfig;
  preferredPythonPath: string;
  r: RInterpreterConfig;
  preferredRPath: string;
}

/**
 * Detect Python and R interpreter defaults for a project directory.
 * Runs both detections concurrently via Promise.allSettled.
 */
export async function getInterpreterDefaults(
  projectDir: string,
  pythonPath?: string,
  rPath?: string,
): Promise<InterpreterDetectionResult> {
  const [pythonResult, rResult] = await Promise.allSettled([
    detectPythonInterpreter(projectDir, pythonPath),
    detectRInterpreter(projectDir, rPath),
  ]);

  const python =
    pythonResult.status === "fulfilled"
      ? pythonResult.value
      : {
          config: { version: "", packageFile: "", packageManager: "" },
          preferredPath: pythonPath || "",
        };

  const r =
    rResult.status === "fulfilled"
      ? rResult.value
      : {
          config: { version: "", packageFile: "", packageManager: "" },
          preferredPath: rPath || "",
        };

  return {
    python: python.config,
    preferredPythonPath: python.preferredPath,
    r: r.config,
    preferredRPath: r.preferredPath,
  };
}
