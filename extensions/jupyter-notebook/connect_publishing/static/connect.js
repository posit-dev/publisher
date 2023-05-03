/* global define */

define([
  'jquery',
  'base/js/namespace',
  'base/js/dialog',
  'services/contents'
], function ($, Jupyter, Dialog) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  var lastSlashInNotebookPath = Jupyter.notebook.notebook_path.lastIndexOf('/');
  if (lastSlashInNotebookPath !== -1) {
    notebookDirectory = Jupyter.notebook.notebook_path.slice(0, lastSlashInNotebookPath);
  }



  function init() {
    // construct notification widget
    notify = Jupyter.notification_area.widget('connect_publishing');

    // create an action that can be invoked from many places (e.g. command
    // palette, button click, keyboard shortcut, etc.)

    // avoid 'accessing "actions" on the global IPython/Jupyter is not recommended' warning
    // https://github.com/jupyter/notebook/issues/2401
    var actions = Jupyter.notebook.keyboard_manager.actions;

    var actionName = actions.register(
      {
        icon: 'fa-cloud-upload',
        help: 'Publish to Posit Connect',
        help_index: 'zz',
        handler: debounce(1000, onPublishClicked)
      },
      'publish',
      'connect_publishing'
    );

    // add a button that invokes the action
    Jupyter.toolbar.add_buttons_group([actionName]);

    // re-style the toolbar button to have a custom icon
    var $button = $('button[data-jupyter-action="' + actionName + '"]');


    $button.find('i')
      .addClass('rsc-icon');
    $button.click(onPublishClicked);
  }

  /***********************************************************************
   * Helpers
   ***********************************************************************/

  var debug = {
    info: function () {
      var args = [].slice.call(arguments);
      args.unshift('Posit Connect:');
      console.info.apply(null, args);
    },
    error: function () {
      var args = [].slice.call(arguments);
      args.unshift('Posit Connect:');
      console.error.apply(null, args);
    }
  };

  function debounce(delay, fn) {
    var timeoutId = null;
    return function () {
      var self = this;
      if (timeoutId === null) {
        fn.apply(self, arguments);
      }
      timeoutId = setTimeout(function () {
        timeoutId = null;
      }, delay);
    };
  }
 
  function onPublishClicked() {
    // This function will be passed (env, event) in the first two
    // positional slots. We're not using them.

    // lazily load the config when clicked since Jupyter's init
    // function is racy w.r.t. loading of notebook metadata
    // maybeCreateConfig();
    // closeMenu();

    // save before publishing so the server can pick up changes
    Jupyter.notebook
      .save_notebook()
      .catch(function (err) {
        // unlikely but possible if we aren't able to save
        debug.error('Failed to save notebook:', err);
        Dialog.modal({
          title: 'connect_publishing',
          body: 'Failed to save this notebook. Error: ' + err,
          buttons: { Ok: { class: 'btn-primary' } }
        });
      });
    
    // const spawn = require('child_process').spawn;
    // const proc = spawn('ls', ['-nat']);
    
    // let output = '';
    // proc.stdout.on('data', (chunk) => {
    //   output += chunk.toString();
    // });
    // proc.on('exit', () => {
    //   console.log(output);
    // });
    var uiSite = 'http://localhost:5173/';
    window.open(uiSite, '_blank');
    console.info(`View publishing client UI at: ${ uiSite }`);
  }

  return {
    init: init
  };
});
