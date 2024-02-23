import * as vscode from 'vscode';

const DEFAULT_COLUMN = vscode.ViewColumn.Beside;

export class Panel {

  private readonly url: string;

  private column: vscode.ViewColumn = DEFAULT_COLUMN;
  private panel?: vscode.WebviewPanel;

  constructor(url: string) {
    this.url = url;
  }

  async show(context: vscode.ExtensionContext): Promise<undefined> {
    // reveal panel if defined
    if (this.panel !== undefined) {
      this.panel.reveal(this.column);
      return;
    }

    // initialize panel
    this.panel = vscode.window.createWebviewPanel(
      'posit.publisher',
      'Posit Publisher',
      this.column,
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
      }
    );

    // set html content
    const uri = await vscode.env.asExternalUri(vscode.Uri.parse(this.url));
    const url = uri.toString();
    this.panel.webview.html = createHTML(url, this.panel.webview);

    // listen for messages
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'reload-webview':
            vscode.commands.executeCommand('workbench.action.webview.reloadWebviewAction');
            return;
        }
      },
      undefined,
      context.subscriptions
    );

    // register view state change
    this.panel.onDidChangeViewState(
      (event) => {
        this.column = event.webviewPanel.viewColumn || DEFAULT_COLUMN;
      },
      null,
      context.subscriptions
    );

    // register dispose
    this.panel.onDidDispose(
      () => {
        this.column = DEFAULT_COLUMN;
        this.panel = undefined;
      },
      null,
      context.subscriptions
    );
  }

  dispose() {
    // this invokes this panel.onDidDispose callback above, which resets the
    this.panel?.dispose();
  }

}


/**
 *
 * @param {string} url - The target server URL (i.e., http://localhost:8080).
 * @param {vscode.Webview} webview - A VSCode webview instance.
 * @returns {string}
 */
export const createHTML = (url: string, webview: vscode.Webview): string => {
  const nonce = createNonce();
  return (
    // install https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html to enable code highlighting below
    /*html*/
    `
        <!DOCTYPE html>
            <head>
                <base href="${url}" />
                <meta
                    http-equiv="Content-Security-Policy"
                    content="${createContentSecurityPolicyContent(nonce, url, webview.cspSource)}"
                />
                <link rel="stylesheet" href="./assets/index.css">
            </head>
            <body>
                <div id="app"></div>
                <script type="text/javascript" nonce="${nonce}" src="./assets/index.js"></script>
            </body>
        </html>
        `
  );
};

/**
 * Creates a Content-Security-Policy value.
 *
 * The Content-Security-Policy controls the resources that the user agent is allowed to load.
 *
 * @param {string[]} allowable - The allowable URLs to inject into the Content-Security-Policy.
 * @returns {string}
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
 */
export const createContentSecurityPolicyContent = (nonce: string, ...allowable: string[]): string => {
  const directives: string[] = [
    'connect-src',
    'font-src',
    'frame-src',
    `script-src nonce-${nonce}`,
    'style-src',
  ];
  const urls: string = allowable.join(" ");
  const content: string = directives.map(_ => `${_} ${urls} https:;`).join(" ");
  return `default-src 'none'; ${content}`;
};

/**
 * Creates a unique nonce value.
 *
 * @returns {string}
 */
const createNonce = (): string => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
