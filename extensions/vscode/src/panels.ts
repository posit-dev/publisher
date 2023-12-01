import * as vscode from 'vscode';

const DEFAULT_COLUMN = vscode.ViewColumn.Beside;

// mutable state
type State = {
    column: vscode.ViewColumn;
    panel?: vscode.WebviewPanel;
};

export class Panel {

    private readonly context: vscode.ExtensionContext;
    private readonly html: string;
    private readonly resources: vscode.Uri[];

    private state: State = { column: DEFAULT_COLUMN };

    constructor(context: vscode.ExtensionContext, resources: vscode.Uri[], url: string) {
        this.context = context;
        this.html =
            // install https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html to enable code highlighting below
            /*html*/
            `
            <!DOCTYPE html>
                <head>
                    <meta
                        http-equiv="content-security-policy"
                        content="default-src 'none'; frame-src ${url} https:; img-src 'unsafe-inline' https:; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
                    />
                </head>
                <body style="padding: 0;">
                    <iframe src="${url}" style="width: 100vw; height: calc(100vh - 3px); border: 0;">
                </body>
            </html>
            `;
        this.resources = resources;
    }

    show() {
        // reveal panel if defined
        if (this.state.panel !== undefined) {
            this.state.panel.reveal(this.state.column);
            return;
        }

        // initialize panel
        this.state.panel = vscode.window.createWebviewPanel(
            'positron.publisher.assistant',
            'Publish Assistant',
            this.state.column,
            {
                enableScripts: true,
                enableForms: true,
                localResourceRoots: this.resources,
            }
        );

        // set html content
        this.state.panel.webview.html = this.html;

        // register view state change
        this.state.panel.onDidChangeViewState(
            (event) => {
                this.state.column = event.webviewPanel.viewColumn || DEFAULT_COLUMN;
            },
            null,
            this.context.subscriptions
        );

        // register dispose
        this.state.panel.onDidDispose(
            () => {
                this.state.column = DEFAULT_COLUMN;
                this.state.panel = undefined;
            },
            null,
            this.context.subscriptions
        );
    }

}
