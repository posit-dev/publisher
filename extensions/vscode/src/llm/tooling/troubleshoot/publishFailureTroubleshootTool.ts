// Copyright (C) 2025 by Posit Software, PBC.

import {
  CancellationToken,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import { LogsViewProvider } from "../../../views/logs";

export class PublishFailureTroubleshootTool implements LanguageModelTool<never> {
  invoke(
    _options: LanguageModelToolInvocationOptions<never>,
    _token: CancellationToken,
  ): LanguageModelToolResult {
    return new LanguageModelToolResult([new LanguageModelTextPart(this.run())]);
  }

  run(): string {
    return LogsViewProvider.getLogsText();
  }
}
