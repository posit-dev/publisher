import * as retry from 'retry';
import * as vscode from 'vscode';
import * as wait from 'wait-on';

import { HOST } from '.';

import * as commands from './commands';
import { Terminal } from './terminals';
import * as workspaces from './workspaces';

export class Server implements Server, vscode.Disposable {

    readonly port: number;
    readonly terminal: Terminal;

    constructor (port: number) {
        this.port = port;
        this.terminal = new Terminal();
    }

    async start(context: vscode.ExtensionContext): Promise<void> {
        const isRunning = await this.isRunning();
        if (!isRunning) {
            const message = vscode.window.setStatusBarMessage("Starting Posit Publisher. Please wait...");
            const path = workspaces.path();
            const command: commands.Command = await commands.create(context, path!, this.port);
            this.terminal.get().sendText(command);
            await this.isRunning();
            // The server will respond as ready before the API has fully initialized. Wait an additional second for good measure.
            await new Promise(_ => setTimeout(_, 1000));
            message.dispose();
        }
    }

    async stop(): Promise<void> {
        const message = vscode.window.setStatusBarMessage("Shutting down Posit Publisher. Please wait...");
        const operation = retry.operation();
		operation.attempt(async () => {
			// send "CTRL+C" command
			this.terminal.get().sendText("\u0003");
			const isRunning = await this.isRunning();

			if (isRunning) {
                // throw error to invoke retry
				throw Error("application is still running");
			}
		});
        message.dispose();
    }

    dispose() {
        this.terminal.dispose();
    }

    private async isRunning(): Promise<boolean> {
        try {
            await wait({
                resources: [
                    `http-get://${HOST}:${this.port}`
                ],
                timeout: 1000
            });
            return true;
        } catch (e) {
            console.warn("failed waiting for port", e);
            return false;
        }
    }

}
