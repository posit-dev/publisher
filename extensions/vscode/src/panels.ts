import * as vscode from 'vscode';

const DEFAULT_COLUMN = vscode.ViewColumn.Beside;

// mutable state
type State = {
    column: vscode.ViewColumn;
    panel?: vscode.WebviewPanel;
};

export class Panel implements vscode.Disposable {

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
            <html lang="en">
                <head>
                    <meta
                        http-equiv="content-security-policy"
                        content="default-src 'none'; frame-src ${url} https:; img-src 'unsafe-inline' https:; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
                    />
                </head>
                <body style="padding: 0;">
                    <script>
                        console.log("THIS IS A SCRIPT");
                        (function() {
                            console.log("Registering VSCodeAPI");
                            const vscode = acquireVsCodeApi();

                            window.addEventListener(
                                'message',
                                (event) => {
                                    console.log('message received', event);
                                    switch (event.data.command) {
                                        case 'alert':
                                            vscode.postMessage({
                                                command: 'alert',
                                                text: 'it worked!'
                                            });
                                    }
                                }
                            )
                        }())
                    </script>

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
            'posit.publisher',
            'Posit Publisher',
            this.state.column,
            {
                enableScripts: true,
                enableForms: true,
                localResourceRoots: this.resources,
            }
        );

        // set html content
        this.state.panel.webview.html = this.html;

        // Handle messages from the webview
        this.state.panel.webview.onDidReceiveMessage(
            message => {
            switch (message.command) {
                case 'alert':
                vscode.window.showErrorMessage(message.text);
                return;
            }
            },
            undefined,
            this.context.subscriptions
        );

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

    dispose() {
        // this invokes this panel.onDidDispose callback above, which resets the state.
        this.state.panel?.dispose();
    }

}
