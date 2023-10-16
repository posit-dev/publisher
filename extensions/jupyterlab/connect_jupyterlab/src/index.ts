import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, IThemeManager } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { requestAPI } from './handler';
import {
  getKernel,
  getKernelPythonPath,
  getKernelPythonVersion
} from './kernel';

const PACKAGE_NAME = 'connect_jupyterlab';
const COMMAND_NAME = 'posit:publish';

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
  currentFrame: HTMLIFrameElement | null = null;
  frames: Map<string, HTMLIFrameElement>;
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
    this.frames = new Map<string, HTMLIFrameElement>();

    const theme = themeManager.theme;
    this.isLightTheme = theme !== null && themeManager.isLight(theme);

    notebookTracker.currentChanged.connect((_, panel) => {
      // If panel is visible, switch to the agent for the new notebook
      this.currentNotebook = panel;
      if (!this.hasClass('lm-mod-hidden')) {
        this.activate();
      }
    });

    this.id = 'posit-publishing-ui';
    this.title.label = 'Posit Publishing';
    this.title.closable = false;
    // this.title.icon = LabIcon.resolveElement({ iconClass: 'posit-publish-icon' }); // nope
    this.addClass('posit-publishing-view');

    const message = document.createElement('div');
    message.classList.add('posit-publishing-message-area');
    message.textContent = 'Initializing; this message should be hidden.';
    message.hidden = true;
    this.node.appendChild(message);
    this.message = message;
  }

  async getOrStartUI(): Promise<void> {
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
    const existingFrame = this.frames.get(notebookPath);

    if (existingURL !== undefined) {
      console.log(`Using existing agent serving at ${existingURL}`);
      if (existingFrame) {
        this.switchToFrame(existingFrame);
        return;
      } else {
        console.error(
          `Agent is running for ${notebookPath}, but there's no frame. Starting a new agent.`
        );
      }
    }
    const kernel = await getKernel(this.currentNotebook, 10);
    const pythonPath = await getKernelPythonPath(kernel);
    console.log('Kernel python path is', pythonPath);
    const pythonVersion = await getKernelPythonVersion(kernel);
    console.log('Kernel python version is', pythonVersion);

    const agentInfo = await launchAgent(
      notebookPath,
      pythonPath,
      pythonVersion,
      this.isLightTheme
    );

    const agentURL = agentInfo.url;
    console.log(`Publishing agent serving at ${agentURL}`);
    this.notebookURLs.set(notebookPath, agentURL);

    if (existingFrame) {
      this.switchToFrame(existingFrame);
    } else {
      const frame = document.createElement('iframe');
      frame.classList.add('posit-publishing-frame');
      frame.src = agentURL;
      this.frames.set(notebookPath, frame);
      this.node.appendChild(frame);
      this.switchToFrame(frame);
    }
  }

  switchToFrame(frame: HTMLIFrameElement | null): void {
    if (this.currentFrame) {
      this.currentFrame.hidden = true;
    }
    if (frame) {
      frame.hidden = false;
    }
    this.currentFrame = frame;
  }

  async onActivateRequest(msg: Message): Promise<void> {
    try {
      await this.getOrStartUI();
      this.message.hidden = true;
    } catch (err) {
      this.message.textContent = '⛔️ ' + err;
      this.message.hidden = false;
      this.switchToFrame(null);
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
