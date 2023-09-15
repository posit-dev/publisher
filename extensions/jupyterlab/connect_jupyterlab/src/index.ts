import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, SessionContext } from '@jupyterlab/apputils';
import { KernelMessage, ServiceManager } from '@jupyterlab/services';
import { JSONObject } from '@lumino/coreutils';
import { requestAPI } from './handler';

const command = 'posit:publish';

async function runPython(
  code: string,
  expression: string,
  manager: ServiceManager.IManager
): Promise<string> {
  const requestContent: KernelMessage.IExecuteRequestMsg['content'] = {
    code,
    user_expressions: {
      value: expression
    },
    stop_on_error: false
  };

  const sessionContext = new SessionContext({
    sessionManager: manager.sessions,
    specsManager: manager.kernelspecs,
    name: 'Kernel Output',
    kernelPreference: {
      autoStartDefault: true
    }
  });

  await sessionContext.initialize();
  const kernel = sessionContext.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  const future = kernel.requestExecute(requestContent, false);
  const reply = await future.done;
  const content = reply.content;

  if (!content) {
    throw new Error('Running python code: no content returned.');
  }
  if (content.status !== 'ok') {
    throw new Error('Running python code: status = ' + content.status);
  }
  const value = content.user_expressions['value'] as JSONObject;
  if (value['status'] !== 'ok') {
    throw new Error('Running python code: value status = ' + value['status']);
  }
  const data = value['data'] as JSONObject;
  const actualExpressionValue = data['text/plain'] as string;
  // remove quotes enclosing the string
  return actualExpressionValue.slice(1, -1);
}

async function getRunningPythonPath(
  manager: ServiceManager.IManager
): Promise<string> {
  return await runPython('import sys', 'sys.executable', manager);
}

async function getRunningPythonVersion(
  manager: ServiceManager.IManager
): Promise<string> {
  return await runPython(
    'import sys',
    '".".join(map(str, sys.version_info[:3]))',
    manager
  );
}

async function getPublishStatus(): Promise<JSONObject> {
  try {
    const data = await requestAPI<JSONObject>('publish');
    console.log(data);
    return data;
  } catch (reason) {
    console.error(
      `The connect_jupyterlab server extension appears to be missing.\n${reason}`
    );
    return {};
  }
}

function makePublishCommand(manager: ServiceManager.IManager) {
  return async function (args: any) {
    console.log(`${command} command has been called from ${args['origin']}.`);
    const pythonPath = await getRunningPythonPath(manager);
    console.log('Kernel python path is', pythonPath);
    const pythonVersion = await getRunningPythonVersion(manager);
    console.log('Python version is', pythonVersion);
    const status = await getPublishStatus();
    console.log('deployment status: ', status);
  };
}

/**
 * Initialization data for the connect_jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'connect_jupyterlab:plugin',
  description: 'A JupyterLab extension for publishing to Posit Connect.',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette) => {
    console.log('JupyterLab extension connect_jupyterlab is activated!');
    const { serviceManager, commands } = app;

    // Add a command
    commands.addCommand(command, {
      label: 'Publish',
      caption: 'Publish to Posit Connect',
      iconClass: 'rsc-icon',
      execute: makePublishCommand(serviceManager)
    });

    // Add the command to the command palette
    const category = 'notebook';
    palette.addItem({ command, category, args: { origin: 'palette' } });
  }
};

export default plugin;
