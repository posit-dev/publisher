import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';

/**
 * Initialization data for the connect_jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'connect_jupyterlab:plugin',
  description: 'A JupyterLab extension for publishing to Posit Connect.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension connect_jupyterlab is activated!');

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
