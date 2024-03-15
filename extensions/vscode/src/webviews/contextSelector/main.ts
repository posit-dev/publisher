import {
  provideVSCodeDesignSystem,
  Button,
  Dropdown,
  ProgressRing,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
  vsCodeProgressRing,
  DropdownOptions,
} from "@vscode/webview-ui-toolkit";

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeProgressRing(),
  vsCodeTextField()
);

// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

// Main function that gets executed once the webview DOM loads
function main() {
  // To get improved type annotations/IntelliSense the associated class for
  // a given toolkit component can be imported and used to type cast a reference
  // to the element (i.e. the `as Button` syntax)
  const deployButton = document.getElementById("deploy-button") as Button;
  deployButton.addEventListener("click", onDeploy);

  setVSCodeMessageListener();

  const deploymentFile = document.getElementById("deployment") as Dropdown;
  deploymentFile.innerHTML = `
    <vscode-option>Option Label #1</vscode-option>
    <vscode-option>Option Label #2</vscode-option>
    <vscode-option>Option Label #3</vscode-option>
    <vscode-option>Option Label #4</vscode-option>
  `;
  deploymentFile.currentValue = 'Option Label #3';

  vscode.postMessage({
    command: "loaded",
  });
}

function onDeploy() {
  const deploymentFile = document.getElementById("deployment") as Dropdown;
  const configFile = document.getElementById("config") as Dropdown;
  const credential = document.getElementById("credential") as Dropdown;

  // Passes a message back to the extension context with the location that
  // should be searched for and the degree unit (F or C) that should be returned
  vscode.postMessage({
    command: "deploy",
    deploymentFile: deploymentFile.value,
    configFile: configFile.value,
    credential: credential.value,
  });

  // Display deploying spinner
}

// Sets up an event listener to listen for messages passed from the extension context
// and executes code based on the message that is recieved
function setVSCodeMessageListener() {
  let count = 0;
  window.addEventListener("message", (event) => {
    const command = event.data.command;

    switch (command) {
      case 'deploymentListUpdate':
        const newDeploymentList = JSON.parse(event.data.payload);
        const deploymentFile = document.getElementById("deployment") as Dropdown;
        deploymentFile.innerHTML = `
          <vscode-option>Option Label #1</vscode-option>
          <vscode-option>Option Label #2</vscode-option>
          <vscode-option>Option Label #3</vscode-option>
          <vscode-option>Option Label #4</vscode-option>
        `;
        deploymentFile.currentValue = 'Option Label #3';
        break;
      case 'configListUpdate':
        const newConfigList = JSON.parse(event.data.payload);
        break;
      case 'credentialListUpdate':
        const newCredentialList = JSON.parse(event.data.payload);
        break;
      case 'deploymentStarting':
        displayLoadingState();
        break;
      case 'deploymentComplete':
        clearLoadingState();
        break;
    }
  });
}

function displayLoadingState() {
  const loading = document.getElementById("loading") as ProgressRing;
  if (loading) {
    loading.classList.remove("hidden");
  }
}

function clearLoadingState() {
  const loading = document.getElementById("loading") as ProgressRing;
  if (loading) {
    loading.classList.add("hidden");
  }
}
