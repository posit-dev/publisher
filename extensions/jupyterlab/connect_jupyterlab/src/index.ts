import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import { JSONObject } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

import { requestAPI } from './handler';

const PACKAGE_NAME = 'connect_jupyterlab';
const COMMAND_NAME = 'posit:publish';

async function runPython(
  code: string,
  expression: string,
  kernel: IKernelConnection
): Promise<string> {
  const requestContent: KernelMessage.IExecuteRequestMsg['content'] = {
    code,
    user_expressions: {
      value: expression
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
  const kernelLanguage = (await kernel.info).language_info.name;
  console.info('Kernel language:', kernelLanguage);
  if (kernelLanguage !== 'python') {
    throw new Error(
      "Can't publish this notebook because it doesn't use the Python kernel"
    );
  }
  console.debug('Using kernel', kernel.id);
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

class PublishStatus {
  busy: boolean = false;
}

async function getPublishStatus(): Promise<PublishStatus> {
  const data = await requestAPI<PublishStatus>('publish');
  console.log(data);
  return data;
}

class PublishResponse {
  url: string = '';
}

async function launchAgent(
  notebookPath: string,
  pythonPath: string,
  pythonVersion: string
): Promise<PublishResponse> {
  const data = await requestAPI<PublishResponse>('publish', {
    body: JSON.stringify({
      notebookPath: notebookPath,
      pythonPath: pythonPath,
      pythonVersion: pythonVersion
    }),
    method: 'POST'
  });
  console.log(data);
  return data;
}

class IFrameWidget extends Widget {
  static unique = 0;

  constructor(notebookPath: string, url: string) {
    super();
    IFrameWidget.unique++;
    this.id = 'posit-publishing-ui-' + IFrameWidget.unique;
    this.title.label = 'Publish ' + notebookPath.split('/').at(-1);
    this.title.closable = true;
    // this.title.icon = LabIcon.resolveElement({ iconClass: 'rsc-icon' }); // nope
    this.addClass('jp-posit-publishing-view');

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '100%';
    this.node.appendChild(iframe);
  }
}

function makePublishCommand(
  notebookTracker: INotebookTracker,
  docManager: IDocumentManager,
  shell: JupyterFrontEnd.IShell
) {
  const uiWidgets = new Map<string, Widget>();
  let notebookPanel: NotebookPanel | null = null;

  notebookTracker.currentChanged.connect((_, panel) => {
    console.log(panel);
    notebookPanel = panel;
  });

  async function publish(calledFrom: string) {
    console.log(`${COMMAND_NAME} command has been called from ${calledFrom}.`);
    if (!notebookPanel) {
      throw new Error(
        "Can't publish because there isn't currently a notebook panel open."
      );
    }
    const context = docManager.contextForWidget(notebookPanel);
    if (!context) {
      throw new Error('Error getting context for the notebook panel.');
    }
    const notebookPath = context.path;
    if (!notebookPath) {
      throw new Error('Error getting the notebook path.');
    }
    const kernel = await getKernel(notebookPanel);
    const pythonPath = await getKernelPythonPath(kernel);
    console.log('Kernel python path is', pythonPath);
    const pythonVersion = await getKernelPythonVersion(kernel);
    console.log('Kernel python version is', pythonVersion);
    const status = await getPublishStatus();
    console.log('Publishing status: ', status);
    if (status.busy) {
      throw new Error(
        "Can't publish because there is already a publishing session open."
      );
    }
    try {
      const agentInfo = await launchAgent(
        notebookPath,
        pythonPath,
        pythonVersion
      );
      console.log(agentInfo);
      const url = agentInfo.url;
      console.log(`Publishing agent serving at ${url}`);

      // The widget is a singleton; if it's open, activate it.
      let widget = uiWidgets.get(notebookPath);
      if (widget && shell.contains(widget)) {
        shell.activateById(widget.id);
      } else {
        widget = new IFrameWidget(notebookPath, url);
        uiWidgets.set(notebookPath, widget);
        shell.add(widget, 'main');
      }
    } catch (err) {
      throw new Error(`Error launching the publishing agent: ${err}`);
    }
  }
  return async function (args: any) {
    try {
      await publish(args['origin']);
    } catch (err) {
      // TODO, obv
      console.error('An error occurred during publishing:', err);
      alert(err);
    }
  };
}

/**
 * Initialization data for the extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: `${PACKAGE_NAME}:plugin`,
  description: 'A JupyterLab extension for publishing to Posit Connect.',
  autoStart: true,
  requires: [ICommandPalette, IDocumentManager, INotebookTracker],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    docManager: IDocumentManager,
    notebookTracker: INotebookTracker
  ) => {
    console.log(`Activating JupyterLab extension ${PACKAGE_NAME}`);
    const { commands, shell } = app;

    // Add a command
    commands.addCommand(COMMAND_NAME, {
      label: 'Publish',
      caption: 'Publish to Posit Connect',
      iconClass: 'rsc-icon',
      execute: makePublishCommand(notebookTracker, docManager, shell)
    });

    // Add the command to the command palette
    const category = 'notebook';
    palette.addItem({
      command: COMMAND_NAME,
      category,
      args: { origin: 'palette' }
    });
  }
};

export default plugin;
