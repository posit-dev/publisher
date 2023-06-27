define([
  'jquery',
  'base/js/events',
  'base/js/namespace',
  'base/js/promises',
  'base/js/utils'
], function ($, events, Jupyter, promises, Utils) {

  // avoid 'accessing "actions" on the global IPython/Jupyter is not recommended' warning
  // https://github.com/jupyter/notebook/issues/2401
  var actions = Jupyter.notebook.keyboard_manager.actions;

  // create action that can be reused for buttons, keyboard shortcuts, etc
  var actionName = actions.register({
    'help': 'Launch Posit Connect publishing client',
    'help_index': 'zz',
    'icon': 'fa-cloud-upload',
    'handler': startUI,
  },
    'publish',
    'connect_jupyternb');

  function openPage(url) {
    console.log(url)
    window.open(url, '_blank');
  }

  function addToolbarButton() {
    Jupyter.toolbar.add_buttons_group([actionName]);
    // re-style the toolbar button to have a custom icon
    var $button = $('button[data-jupyter-action="' + actionName + '"]');
    $button.find('i')
      .addClass('rsc-icon');
  }

  function getRunningPythonPath() {
    var cmd = 'import sys; print(sys.executable)';
    var pythonPath = 'python';
    var result = $.Deferred();

    function handle_output(message) {
        try {
            pythonPath = message.content.text.trim();
            console.log('Using python: ' + pythonPath);
            result.resolve(pythonPath);
        } catch (err) {
            result.reject(err);
        }
    }
    var callbacks = {
        iopub: {
            output: handle_output
        }
    };
    Jupyter.notebook.kernel.execute(cmd, callbacks);
    return result;
  }

  function startUI() {
    getRunningPythonPath().then(function (pythonPath) {
      var notebookURL = Jupyter.notebook.base_url + 'connect_jupyternb/start_ui';
      Utils.ajax(notebookURL, {
        type: 'POST',
        data: JSON.stringify({
          python: pythonPath,
          notebook: Jupyter.notebook.notebook_path,
        }),
        success: function (response) {
          var url = response.ui_url;
          console.info('UI url: ', url)
          openPage(url);
        },
        error: function (response) {
          console.error('UI launch failed:', response.statusText);
          alert(response.statusText)
        }
      });
    });
  }

  function load_ipython_extension() {
    promises.app_initialized.then(function (app) {
      if (app === 'NotebookApp') {
        // add custom css
        $('<link/>')
          .attr({
            href: requirejs.toUrl('nbextensions/connect_jupyternb/main.css'),
            rel: 'stylesheet',
            type: 'text/css'
          })
          .appendTo('head');

        addToolbarButton();
      }
    });
  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});

