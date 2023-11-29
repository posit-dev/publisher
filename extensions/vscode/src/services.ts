var mutexify = require('mutexify/promise');

import * as vscode from 'vscode';

import { Assistant } from './assistants';
import * as ports from './ports';

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
	check = async (current: State, callback: Function): Promise<boolean> => {
		// acquire the lock
		const release = await this.lock();
		try {
			if (this.state === current) {
				await callback();
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
			vscode.window.showInformationMessage("The Publish Assistant failed. Please try again.");
			return false;
		} finally {
			// always release the lock
			release();
		}
	};

	// Transistions the internal state from the current state the next state.
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
			vscode.window.showInformationMessage("The Publish Assistant failed. Please try again.");
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
		if (Service.instance === undefined) {
			const port = await ports.acquire();
			const resources = [
				vscode.Uri.joinPath(context.extensionUri, "out"),
				vscode.Uri.joinPath(context.extensionUri, "assets")
			];
			const assistant = new Assistant(port, resources);
			Service.instance = new Service(assistant);
		}
		return Service.instance;
	};

	private constructor(assistant: Assistant) {
		this.assistant = assistant;
	}

	start = async () => {
		const isRunning = await this.manager.check("RUNNING", () => {
			console.debug("the service is already running");
		});

		if (isRunning) {
			this.assistant.show();
			return;
		}

		await this.manager.transition("NEW", "STARTING", async () => {
			console.debug("the service is starting");
			vscode.window.showInformationMessage("Starting the Publish Assistant. Please wait.");
			await this.assistant.start();
		});

		await this.manager.transition("STARTING", "RUNNING", async () => {
			console.debug("the service is running");
			vscode.window.showInformationMessage("The Publish Assistant is now avaiable!");
			this.assistant.show();
		});
	};

	stop = async () => {
		const isTerminated = await this.manager.check("NEW", () => {
			console.debug("the service isn't running");
		});

		if (isTerminated) {
			return;
		}

		this.manager.transition("RUNNING", "STOPPING", async () => {
			console.debug("the service is stopping");
			vscode.window.showInformationMessage("Stopping the Publish Assistant. Please wait...");
			await this.assistant.stop();
		});

		this.manager.transition("STOPPING", "TERMINATED", async () => {
			console.debug("the service is terminated");
			vscode.window.showInformationMessage("The Publish Assistant has shutdown successfully.");
		});

		this.manager.transition("TERMINATED", "NEW", async () => {
			console.debug("the service is ready");
		});
	};

}
