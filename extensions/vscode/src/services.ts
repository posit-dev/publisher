import * as vscode from 'vscode';

import { Panel } from './panels';
import { Server } from './servers';

export class Service implements vscode.Disposable {

	private panel: Panel;
	private server: Server;

	constructor(port: number) {
		this.panel = new Panel(port);
		this.server = new Server(port);
	}

	start = async (context: vscode.ExtensionContext) => {
		await this.server.start(context);
	};

	open = async (context: vscode.ExtensionContext) => {
		// re-run the start sequence in case the server has stopped.
		await this.server.start(context);
		this.panel.show(context);
	};

	stop = async () => {
		await this.server.stop();
		this.panel.dispose();
		this.server.dispose();
	};

	dispose() {
		this.panel.dispose();
		this.server.dispose();
	}

}
