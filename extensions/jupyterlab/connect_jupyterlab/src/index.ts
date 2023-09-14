import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
} from '@jupyterlab/apputils';

import { requestAPI } from './handler';

/**
 * Initialization data for the connect_jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'connect_jupyterlab:plugin',
  description: 'A JupyterLab extension for publishing to Posit Connect.',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette) => {
    console.log('JupyterLab extension connect_jupyterlab is activated!');
    const { commands } = app;

    const command = 'posit:publish';

    // Add a command
    commands.addCommand(command, {
      label: 'Publish',
      caption: 'Publish to Posit Connect',
      iconClass: 'rsc-icon',
      execute: (args: any) => {
        console.log(
          `${command} command has been called from ${args['origin']}.`
        );
      }
    });

    // Add the command to the command palette
    const category = 'notebook';
    palette.addItem({ command, category, args: { origin: 'palette' } });

    // Example API request, doesn't belong here.
    requestAPI<any>('get-example')
    .then(data => {
      console.log(data);
    })
    .catch(reason => {
      console.error(
        `The connect_jupyterlab server extension appears to be missing.\n${reason}`
      );
    });
  }
};

export default plugin;
