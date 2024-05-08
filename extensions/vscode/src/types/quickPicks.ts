import {
  Account,
  Configuration,
  Deployment,
  PreDeploymentWithConfig,
} from "src/api";
import { QuickPickItem } from "vscode";

export interface DestinationQuickPick extends QuickPickItem {
  deployment: Deployment | PreDeploymentWithConfig;
  config?: Configuration;
  credential?: Account;
  lastMatch: boolean;
}
