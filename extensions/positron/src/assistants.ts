import * as wait from 'wait-on';

import * as vscode from 'vscode';

import * as commands from './commands';

const name: string = "publisher";

type CreateAssistantParameters = {
	path: string,
	port: number,
	resources: vscode.Uri[],
};

class Assistant {


	readonly path: string;
	readonly port: number;
	readonly terminal: vscode.Terminal;
	readonly resources: vscode.Uri[];

	constructor(path: string, port: number, resources: vscode.Uri[]) {
		this.path = path;
		this.port = port;
		this.resources = resources;
		this.terminal = vscode.window.createTerminal({ name: name });
	}

	render = async () => {
		const panel = vscode.window.createWebviewPanel(
			'positron.publish.assistant',
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
		this.terminal.show();
		const command: commands.Command = commands.create(this.path, this.port);
		this.terminal.sendText(command);
		console.debug("Waiting 3000 ms for ui to initialize");
		await new Promise(resolve => setTimeout(resolve, 3000));
		console.debug("Finished waiting for the ui to initialize");
	};

}


export const create = (params: CreateAssistantParameters): Assistant => {
	return new Assistant(params.path, params.port, params.resources);
};
