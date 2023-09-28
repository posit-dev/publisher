import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, IThemeManager } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import { JSONObject } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { requestAPI } from './handler';

const PACKAGE_NAME = 'connect_jupyterlab';
const COMMAND_NAME = 'posit:publish';

async function runPython(
  toRun: string,
  toEvaluate: string,
  kernel: IKernelConnection
): Promise<string> {
  const requestContent: KernelMessage.IExecuteRequestMsg['content'] = {
    code: toRun,
    user_expressions: {
      value: toEvaluate
    },
    stop_on_error: false
  };

  const future = kernel.requestExecute(requestContent, false);
  const replyMessage = await future.done;
  const content = replyMessage.content;

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

async function getKernel(
  notebookPanel: NotebookPanel
): Promise<IKernelConnection> {
  const sessionContext = notebookPanel.sessionContext;
  const kernel = sessionContext.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  console.info('Using kernel', kernel.id);
  const kernelLanguage = (await kernel.info).language_info.name;
  console.info('Kernel language:', kernelLanguage);
  if (kernelLanguage !== 'python') {
    throw new Error(
      "Can't publish this notebook because it doesn't use the Python kernel"
    );
  }
  return kernel;
}

async function getKernelPythonPath(kernel: IKernelConnection): Promise<string> {
  return await runPython('import sys', 'sys.executable', kernel);
}

async function getKernelPythonVersion(
  kernel: IKernelConnection
): Promise<string> {
  return await runPython(
    'import sys',
    '".".join(map(str, sys.version_info[:3]))',
    kernel
  );
}

// class PublishStatus {
//   busy: boolean = false;
// }

// async function getPublishStatus(): Promise<PublishStatus> {
//   const data = await requestAPI<PublishStatus>('publish');
//   console.log(data);
//   return data;
// }

class PublishResponse {
  url: string = '';
}

async function launchAgent(
  notebookPath: string,
  pythonPath: string,
  pythonVersion: string,
  isLightTheme: boolean
): Promise<PublishResponse> {
  const theme = isLightTheme ? 'light' : 'dark';
  const data = await requestAPI<PublishResponse>('publish', {
    body: JSON.stringify({
      notebookPath: notebookPath,
      pythonPath: pythonPath,
      pythonVersion: pythonVersion,
      theme: theme
    }),
    method: 'POST'
  });
  console.log(data);
  return data;
}

class PublishingWidget extends Widget {
  frame: HTMLIFrameElement;
  message: HTMLDivElement;
  currentNotebook: NotebookPanel | null = null;
  docManager: IDocumentManager;
  notebookURLs: Map<string, string>;
  isLightTheme: boolean;

  constructor(
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager,
    themeManager: IThemeManager
  ) {
    super();
    this.notebookURLs = new Map<string, string>();
    this.docManager = docManager;

    const theme = themeManager.theme;
    this.isLightTheme = theme !== null && themeManager.isLight(theme);

    notebookTracker.currentChanged.connect((_, panel) => {
      console.log('Switch to panel', panel);
      this.currentNotebook = panel;
      this.activate();
    });

    this.id = 'posit-publishing-ui';
    this.title.label = 'Posit Publishing';
    this.title.closable = false;
    // this.title.icon = LabIcon.resolveElement({ iconClass: 'posit-publish-icon' }); // nope
    this.addClass('posit-publishing-view');

    const frame = document.createElement('iframe');
    frame.classList.add('posit-publishing-frame');
    this.node.appendChild(frame);
    this.frame = frame;

    const message = document.createElement('div');
    message.classList.add('posit-publishing-message-area');
    message.textContent = 'Initializing; this message should be hidden.';
    message.hidden = true;
    this.node.appendChild(message);
    this.message = message;
  }

  async getOrStartUI(): Promise<string> {
    if (!this.currentNotebook) {
      throw new Error('Open a notebook to publish it.');
    }
    const context = this.docManager.contextForWidget(this.currentNotebook);
    if (!context) {
      throw new Error('Error getting context for the notebook panel.');
    }
    const notebookPath = context.path;
    if (!notebookPath) {
      throw new Error('Error getting the notebook path.');
    }
    const existingURL = this.notebookURLs.get(notebookPath);
    if (existingURL !== undefined) {
      console.log(`Using existing agent serving at ${existingURL}`);
      return existingURL;
    }
    const kernel = await getKernel(this.currentNotebook);
    const pythonPath = await getKernelPythonPath(kernel);
    console.log('Kernel python path is', pythonPath);
    const pythonVersion = await getKernelPythonVersion(kernel);
    console.log('Kernel python version is', pythonVersion);

    const agentInfo = await launchAgent(
      notebookPath,
      pythonPath,
      pythonVersion,
      this.isLightTheme,
    );
    const agentURL = agentInfo.url;
    console.log(`Publishing agent serving at ${agentURL}`);
    this.notebookURLs.set(notebookPath, agentURL);
    return agentURL;
  }

  async onActivateRequest(msg: Message): Promise<void> {
    try {
      const url = await this.getOrStartUI();
      this.message.hidden = true;
      this.frame.src = url;
      this.frame.hidden = false;
    } catch (err) {
      this.message.textContent = '⛔️ ' + err;
      this.frame.hidden = true;
      this.message.hidden = false;
    }
  }
}

async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  docManager: IDocumentManager,
  notebookTracker: INotebookTracker,
  themeManager: IThemeManager
) {
  console.log(`Activating JupyterLab extension ${PACKAGE_NAME}`);
  const { commands, shell } = app;
  const widget = new PublishingWidget(
    notebookTracker,
    docManager,
    themeManager
  );
  shell.add(widget, 'right');

  // Add a command
  commands.addCommand(COMMAND_NAME, {
    label: 'Publish',
    caption: 'Publish to Posit Connect',
    iconClass: 'posit-publish-icon',
    execute: () => {
      shell.activateById(widget.id);
    }
  });

  // Add the command to the command palette
  const category = 'notebook';
  palette.addItem({
    command: COMMAND_NAME,
    category
  });
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: `${PACKAGE_NAME}:plugin`,
  description: 'A JupyterLab extension for publishing to Posit Connect.',
  autoStart: true,
  requires: [
    ICommandPalette,
    IDocumentManager,
    INotebookTracker,
    IThemeManager
  ],
  activate: activate
};

export default plugin;
