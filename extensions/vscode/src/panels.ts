import * as vscode from 'vscode';

const DEFAULT_COLUMN = vscode.ViewColumn.Beside;

export interface IPanel extends vscode.Disposable {
    show: () => Promise<undefined>;
}

export class Panel implements IPanel {

    private readonly context: vscode.ExtensionContext;
    private readonly url: string;

    private column: vscode.ViewColumn = DEFAULT_COLUMN;
    private panel?: vscode.WebviewPanel;

    /**
     * Creates a Panel implementation.
     *
     * @param {vscode.ExtensionContext} context - The extension content
     * @param {string} url - The server url (i.e., http://localhost:8080)
     */
    constructor(context: vscode.ExtensionContext, url: string) {
        this.context = context;
        this.url = url;
    }

    async show(): Promise<undefined> {
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

        // register view state change
        this.panel.onDidChangeViewState(
            (event) => {
                this.column = event.webviewPanel.viewColumn || DEFAULT_COLUMN;
            },
            null,
            this.context.subscriptions
        );

        // register dispose
        this.panel.onDidDispose(
            () => {
                this.column = DEFAULT_COLUMN;
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
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
 * @returns
 */
export const createHTML = (url: string, webview: vscode.Webview): string => {
    return (
        // install https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html to enable code highlighting below
        /*html*/
        `
        <!DOCTYPE html>
            <head>
                <base href="${url}" />
                <meta
                    http-equiv="Content-Security-Policy"
                    content="${createContentSecurityPolicyContent(url, webview.cspSource)}"
                />
                <link rel="stylesheet" href="./assets/index.css">
            </head>
            <body>
                <div id="app"></div>
                <script type="text/javascript" src="./assets/index.js"></script>
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
 * @returns
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
 */
export const createContentSecurityPolicyContent = (...allowable: string[]): string => {
    const directives: string[] = [
        'connect-src',
        'font-src',
        'frame-src',
        'script-src',
        'style-src',
    ];
    const urls: string = allowable.join(" ");
    const content: string = directives.map(_ => `${_} ${urls} https:;`).join(" ");
    return `default-src 'none'; ${content}`;
};
