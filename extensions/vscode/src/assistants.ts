import * as vscode from 'vscode';
import * as wait from 'wait-on';

import * as commands from './commands';

export class Assistant {

    private readonly name: string = "Publish Assistant";

	private readonly path: string;
	private readonly port: number;
	readonly resources: vscode.Uri[];

	constructor(port: number, resources: vscode.Uri[]) {
        const path = vscode.workspace.workspaceFolders?.at(0)?.uri.path;
        if (path === undefined) {
			throw new Error("workspace path is undefined");
		}
        this.path = path;
		this.port = port;
		this.resources = resources;
	}

	focus = async () => {
		const panel = vscode.window.createWebviewPanel(
			'positron.publisher.assistant',
			'Publish Assistant',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				enableForms: true,
				localResourceRoots: this.resources,
			}
		);

		const uri = await vscode.env.asExternalUri(vscode.Uri.parse(`http://127.0.0.1:${this.port}`));
		const url = uri.toString();
		panel.webview.html =
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
	};

	start = async (): Promise<void> => {
		const command: commands.Command = commands.create(this.path, this.port);
        const terminal = vscode.window.createTerminal({ name: this.name, hideFromUser: true });
		terminal.sendText(command);
		console.debug("waiting for the server to start");
		await wait({
            resources: [
                `http-get://127.0.0.1:${this.port}`
            ]
        });
	};

}
