// Copyright (C) 2026 by Posit Software, PBC.

// Contract: llm/index.ts → lm.registerTool (path 1) and commands.registerCommand
// (path 2, the Positron positron.ai agent allow-list). Both paths back the same
// tool instances, so this contract also pins that the path-2 command handlers
// normalize into run() regardless of which calling convention Positron used —
// a single object keyed by the `agent.args` names, or the same values spread
// positionally in that order. Positron doesn't consistently pick one; the same
// command has been observed invoked both ways within a single session.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { lm, commands } from "vscode";

// Mock internal dependencies. The tool modules transitively pull in the heavy
// src/toml + src/api + src/state graph, so we stub them to keep this contract
// focused on the registration wiring (and to avoid loading that graph).
vi.mock("src/llm/tooling/troubleshoot/publishFailureTroubleshootTool", () => ({
  PublishFailureTroubleshootTool: vi.fn(function () {
    return { name: "publish-failure" };
  }),
}));

vi.mock("src/llm/tooling/troubleshoot/configurationTroubleshootTool", () => ({
  ConfigurationTroubleshootTool: vi.fn(function () {
    return { name: "config-error" };
  }),
}));

// Shared run() spies for the three deploy tools so we can assert the path-2
// command handlers forward their single object argument into run().
const { planRun, deployRun, addCredentialRun } = vi.hoisted(() => ({
  planRun: vi.fn(),
  deployRun: vi.fn(),
  addCredentialRun: vi.fn(),
}));

vi.mock("src/llm/tooling/deploy/planDeploymentTool", () => ({
  PlanDeploymentTool: vi.fn(function () {
    return { run: planRun };
  }),
}));

vi.mock("src/llm/tooling/deploy/deployContentTool", () => ({
  DeployContentTool: vi.fn(function () {
    return { run: deployRun };
  }),
}));

vi.mock("src/llm/tooling/deploy/addCredentialTool", () => ({
  AddCredentialTool: vi.fn(function () {
    return { run: addCredentialRun };
  }),
}));

const { registerLLMTooling } = await import("src/llm/index");

function makeContext() {
  return {
    subscriptions: [] as any[],
    extension: { packageJSON: { version: "1.2.3" } },
  };
}

// Return the handler registered for a given command id.
function handlerFor(id: string): (...args: any[]) => any {
  const call = (
    commands.registerCommand as unknown as { mock: { calls: any[][] } }
  ).mock.calls.find((c) => c[0] === id);
  if (!call) {
    throw new Error(`No command registered with id "${id}"`);
  }
  return call[1];
}

function register() {
  registerLLMTooling(makeContext() as any, {} as any, {} as any);
}

describe("llm-tools contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Path 1 — vscode.lm Language Model Tools.
  it.each([
    "publish-content_troubleshootDeploymentFailure",
    "publish-content_troubleshootConfigurationError",
    "publish-content_planDeployment",
    "publish-content_deployContent",
    "publish-content_addCredential",
  ])("registers the %s language model tool", (toolName) => {
    register();

    expect(lm.registerTool).toHaveBeenCalledWith(toolName, expect.any(Object));
  });

  // Path 2 — agent-compatible commands for Positron's positron.ai allow-list.
  it.each([
    "posit.publisher.agent.planDeployment",
    "posit.publisher.agent.deployContent",
    "posit.publisher.agent.addCredential",
  ])("registers the %s agent command", (commandId) => {
    register();

    expect(commands.registerCommand).toHaveBeenCalledWith(
      commandId,
      expect.any(Function),
    );
  });

  it("planDeployment command forwards its input object into run()", () => {
    register();

    handlerFor("posit.publisher.agent.planDeployment")({
      directory: "sub dir",
    });

    expect(planRun).toHaveBeenCalledWith({ directory: "sub dir" });
  });

  it("planDeployment command maps a positional directory into run()", () => {
    register();

    handlerFor("posit.publisher.agent.planDeployment")("sub dir");

    expect(planRun).toHaveBeenCalledWith({ directory: "sub dir" });
  });

  it("planDeployment command defaults to an empty object when Positron omits args", () => {
    register();

    handlerFor("posit.publisher.agent.planDeployment")();

    expect(planRun).toHaveBeenCalledWith({});
  });

  it("deployContent command forwards its input object into run()", () => {
    register();

    const input = {
      directory: "project dir",
      entrypoint: "app.py",
      credentialName: "my-cred",
      title: "My Title",
      contentType: "python-shiny",
      deploymentName: "deployment-1",
      configurationName: "config-1",
    };

    handlerFor("posit.publisher.agent.deployContent")(input);

    expect(deployRun).toHaveBeenCalledWith(input);
  });

  it("deployContent command maps positional args into run() in agent.args order", () => {
    register();

    handlerFor("posit.publisher.agent.deployContent")(
      "project dir",
      "app.py",
      "my-cred",
      "My Title",
      "python-shiny",
    );

    expect(deployRun).toHaveBeenCalledWith({
      directory: "project dir",
      entrypoint: "app.py",
      credentialName: "my-cred",
      title: "My Title",
      contentType: "python-shiny",
    });
  });

  it("addCredential command forwards its input object into run()", () => {
    register();

    const input = {
      serverUrl: "https://connect.example.com",
      target: "connect",
      authMethod: "apiKey",
    };

    handlerFor("posit.publisher.agent.addCredential")(input);

    expect(addCredentialRun).toHaveBeenCalledWith(input);
  });

  it("addCredential command maps positional args into run() in agent.args order", () => {
    register();

    handlerFor("posit.publisher.agent.addCredential")(
      "https://connect.example.com",
      "connect",
    );

    expect(addCredentialRun).toHaveBeenCalledWith({
      serverUrl: "https://connect.example.com",
      target: "connect",
    });
  });

  it("addCredential command defaults to an empty object when Positron omits args", () => {
    register();

    handlerFor("posit.publisher.agent.addCredential")();

    expect(addCredentialRun).toHaveBeenCalledWith({});
  });
});
