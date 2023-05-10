define([
  'jquery',
  'base/js/events',
  'base/js/namespace',
  'base/js/promises'
], function($, events, Jupyter, promises) {

  // avoid 'accessing "actions" on the global IPython/Jupyter is not recommended' warning
  // https://github.com/jupyter/notebook/issues/2401
  var actions = Jupyter.notebook.keyboard_manager.actions;

  // create action that can be reused for buttons, keyboard shortcuts, etc
  var actionName = actions.register({
      'help': 'Launch Posit Connect publishing client',
      'help_index': 'zz',
      'icon': 'fa-cloud-upload',
      'handler': openUI,

    }, 
    'publish',
    'connect_publishing');

  function openUI() {
    var url = 'http://localhost:5173/'
    window.open(url, '_blank');
  }

  function addToolbarButton() {
    Jupyter.toolbar.add_buttons_group([actionName]);
    // re-style the toolbar button to have a custom icon
    var $button = $('button[data-jupyter-action="' + actionName + '"]');
    $button.find('i')
     .addClass('rsc-icon');

  }
  
  function load_ipython_extension() {
    promises.app_initialized.then(function(app) {
      if (app === 'NotebookApp') {
        // add custom css
        $('<link/>')
          .attr({
            href: requirejs.toUrl('nbextensions/connect_publishing/main.css'),
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
