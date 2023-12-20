var mutexify = require('mutexify/promise');

import * as vscode from 'vscode';

import { HOST } from '.';
import { Assistant } from './assistants';
import { Panel } from './panels';
import * as ports from './ports';
import * as workspaces from './workspaces';

type State = "NEW" | "STARTING" | "RUNNING" | "STOPPING" | "TERMINATED" | "FAILED";

class StateManager {

	private lock;
	private state: State = "NEW";

	constructor () {
		this.lock = mutexify();
	}

	// Checks if the expected current state matches the internal state.
	// If the states match, the callback is executed. If successful, true is returned.
	// Otherwise, false is returned.
	check = async (...current: State[]): Promise<boolean> => {
		// acquire the lock
		const release = await this.lock();
		try {
			if (current.includes(this.state)) {
				return true;
			}
			return false;
		} catch (e: unknown) {
			if (e instanceof Error) {
				console.error(e.message);
				throw e;
			}
			this.state = "FAILED";
			console.warn("unhandled error", e);
			vscode.window.showInformationMessage("Posit Publisher failed. Please try again.");
			return false;
		} finally {
			// always release the lock
			release();
		}
	};

	// Transitions the internal state from the current state the next state.
	// If the internal state does not match the current state, an error is thrown.
	// Otherwise, the callback is executed and the state is set to the provided next state.
	transition = async (current: State, next: State, callback: Function): Promise<State> => {
		// acquire the lock
		const release = await this.lock();
		try {
			if (this.state === current) {
				await callback();
				this.state = next;
				return this.state;
			}
			throw Error(`current state (${current}) does not match internal state (${this.state}).`);
		} catch (e: unknown) {
			if (e instanceof Error) {
				console.error(e.message);
				throw e;
			}
			this.state = "FAILED";
			console.warn("unhandled error", e);
			vscode.window.showInformationMessage("Posit Publisher failed. Please try again.");
			return this.state;
		} finally {
			// always release the lock
			release();
		}
	};
}

export class Service {

	private static instance: Service | undefined = undefined;

	private manager: StateManager = new StateManager();

	private assistant: Assistant;

	static get = async (context: vscode.ExtensionContext): Promise<Service> => {
		if (Service.instance !== undefined) {
			return Service.instance;
		}

		// create panel
		const port = await ports.acquire();
		const resources = [
			vscode.Uri.joinPath(context.extensionUri, "out"),
			vscode.Uri.joinPath(context.extensionUri, "assets")
		];
		const uri = await vscode.env.asExternalUri(vscode.Uri.parse(`http://${HOST}:${port}`));
		const url = uri.toString();
		const panel = new Panel(context, resources, url);

		// create assistant
		const path = workspaces.path();
		if (path === undefined) {
			throw new Error("workspace path is undefined");
		}
		const assistant = new Assistant(panel, path, port);

		// create service
		const service = new Service(assistant);
		Service.instance = service;
		return service;
	};

	private constructor(assistant: Assistant) {
		this.assistant = assistant;
	}

	start = async () => {
		const isRunning = await this.manager.check("RUNNING");

		if (isRunning) {
			console.debug("the service is already running");
			this.assistant.show();
			return;
		}

		let message: vscode.Disposable;
		await this.manager.transition("NEW", "STARTING", async () => {
			console.debug("the service is starting");
			message = vscode.window.setStatusBarMessage("Starting Posit Publisher. Please wait...");
			await this.assistant.start();
		});

		await this.manager.transition("STARTING", "RUNNING", async () => {
			console.debug("the service is running");
			this.assistant.show();
			if (message) {
				message.dispose();
			}
		});
	};

	stop = async () => {
		const isStopped = await this.manager.check("NEW", "TERMINATED", "FAILED");

		if (isStopped) {
			console.debug("the service isn't running");
			return;
		}

		let message: vscode.Disposable;
		await this.manager.transition("RUNNING", "STOPPING", async () => {
			console.debug("the service is stopping");
			message = vscode.window.setStatusBarMessage("Shutting down Posit Publisher. Please wait...");
			await this.assistant.stop();
		});

		await this.manager.transition("STOPPING", "NEW", async () => {
			console.debug("the service is terminated");
			if (message) {
				message.dispose();
			}
		});
	};

}
