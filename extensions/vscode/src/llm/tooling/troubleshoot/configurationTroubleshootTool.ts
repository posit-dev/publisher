// Copyright (C) 2025 by Posit Software, PBC.

import {
  CancellationToken,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import {
  Configuration,
  ConfigurationError,
  isConfigurationError,
} from "../../../api";
import { PublisherState } from "../../../state";
import {
  ContentType,
  allValidContentTypes,
  contentTypeStrings,
} from "../../../api/types/configurations";

export class ConfigurationTroubleshootTool implements LanguageModelTool<never> {
  state: PublisherState;

  constructor(state: PublisherState) {
    this.state = state;
  }

  async invoke(
    _options: LanguageModelToolInvocationOptions<never>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const config = await this.state.getSelectedConfiguration();
    if (!config) {
      // There is no existing selected configuration.
      return this.noopToolResult();
    }

    if (isConfigurationError(config)) {
      // Help with current configuration error
      return this.helpWithConfigErrorToolResult(config);
    }

    if (this.isUnknownSet(config)) {
      // Help with content type "unknown"
      return this.helpWithUnknownToolResult(config);
    }

    return new LanguageModelToolResult([
      new LanguageModelTextPart(
        "Nothing seems to be wrong with the current deployment configuration.",
      ),
    ]);
  }

  private isUnknownSet(config: Configuration) {
    return config.configuration.type === ContentType.UNKNOWN;
  }

  private noopToolResult() {
    const noopMsg = `The user does not have a selected deployment configuration,
so there is nothing to help with at the moment. A deployment configuration needs to be selected
or the user should start a new deployment first, and in case of configuration errors, then this tool can be used to help the user.`;

    return new LanguageModelToolResult([new LanguageModelTextPart(noopMsg)]);
  }

  private helpWithConfigErrorToolResult(config: ConfigurationError) {
    const { error, configurationPath } = config;
    const toolInstruction = `The current deployment configuration file has the following error
"${error.msg}", read the deployment configuration file at ${configurationPath} to find possible solutions
that help the user get past this error. Offer the user help to edit the deployment configuration file,
present the possible changes and ask for permission to do it.`;
    return new LanguageModelToolResult([
      new LanguageModelTextPart(toolInstruction),
    ]);
  }

  private helpWithUnknownToolResult(config: Configuration) {
    const { projectDir, configurationPath } = config;
    const readProjectDirInstruction = `Take a look to the files under ${projectDir} to see 
if you can help the user find a proper content type to be used that is not "unknown".
Offer the user help to edit the deployment configuration file at ${configurationPath},
present the possible changes and ask for permission to do it.
It is important, that if the type field changes from "unknown" to a proper content type,
the configuration file may require one or more additional TOML sections if not present:
- "[quarto]" for content that uses Quarto.
- "[r]" section for content that uses the R runtime, Quarto projects might use R too.
- "[python]" section for content that uses Python, Quarto projects might use Python too.
If any of the "[r]" or "[python]" sections are added, only add the section heading, without additional values
since this allows the deployment to be flexible and use the current system interpreters, which is the most common case.
If the "[quarto]" section is added:
- Include the "version" field with the current Quarto version on the system.
- Include "jupyter" within the "engines" field only if the project requires Python.
- Include "knitr" within the "engines" field only if the project requires R.
- Include "markdown" within the "engines" field only if the project does not require R nor Python.
`;

    return new LanguageModelToolResult([
      new LanguageModelTextPart(
        this.contentTypesInstructions(configurationPath),
      ),
      new LanguageModelTextPart(readProjectDirInstruction),
    ]);
  }

  private contentTypesInstructions(configPath: string): string {
    const genTypeDescription = (type: ContentType): string => {
      return `- The content type ID "${type}" should be used for projects to ${contentTypeStrings[type]}
      `;
    };

    const genAllDescriptions = (): string => {
      let allDescs = "";
      allValidContentTypes.forEach((type) => {
        allDescs += genTypeDescription(type);
      });
      return allDescs;
    };

    return `The current deployment configuration file at ${configPath} has "unknown" as the "type" key,
the "unknown" content type is set in the deployment configuration when the detection mechanisms in the Publisher extension
fail to infer a specific content type for the project to be deployed.
The following list has descriptions with the possible IDs that can be used as the content type.
Only one must be choosen:
${genAllDescriptions()}
`;
  }
}
