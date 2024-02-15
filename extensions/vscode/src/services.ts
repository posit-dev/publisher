var mutexify = require('mutexify/promise');

import * as vscode from 'vscode';

import { HOST } from '.';
import { Panel } from './panels';
import { Server } from './servers';

export class Service implements vscode.Disposable {

	private context: vscode.ExtensionContext;
	private panel: Panel;
	private server: Server;

	constructor(context: vscode.ExtensionContext, port: number) {
		this.context = context;
		this.panel = new Panel(port);
		this.server = new Server(port);
	}

	start = async () => {
		await this.server.start(this.context);
	};

	open = async () => {
		// re-run the start sequence in case the server has stopped.
		await this.server.start(this.context);
		this.panel.show(this.context);
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
