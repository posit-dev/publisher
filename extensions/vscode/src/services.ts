import * as vscode from 'vscode';

import { Assistant } from './assistants';
import * as ports from './ports';

type State = "NEW" | "STARTING" | "RUNNING" | "STOPPING" | "TERMINATED" | "FAILED";

class Service {

	private static instance: Service | undefined = undefined;

	private state: State = "NEW";

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
		try {
			if (this.isRunning()) {
				console.debug("the service is already running");
				await this.assistant.focus();
				return;
			}
			console.debug("the service is starting");
			vscode.window.showInformationMessage("Initializing the Publish Assistant. Please wait.");
			this.state = "STARTING";
			await this.assistant.start();
			console.debug("the service is running");
			this.state = "RUNNING";
			await this.assistant.focus();
		} catch (e: unknown) {
			this.state = "FAILED";
			vscode.window.showInformationMessage("Failed to initialize the Publish Assistant.");
			if (e instanceof Error) {
				console.error(e.message);
				throw e;
			}
			console.warn("unhandled error", e);
		}
	};

	stop = async () => {
		try {
			if (!this.isRunning()) {
				console.debug("the service is already stopped");
				return;
			}
			console.debug("the service is stopping");
			this.state = "STOPPING";
			// kill
			console.debug("the service is terminated");
			this.state = "TERMINATED";
		} catch (e: unknown) {
			this.state = "FAILED";
			if (e instanceof Error) {
				console.error(e.message);
				throw e;
			}
			console.warn("unhandled error", e);
		}
	};

	isRunning = (): boolean => {
		console.log(this.state);
		switch (this.state) {
			case "STARTING":
			case "RUNNING":
			case "STOPPING":
				return true;
			default:
				return false;
		}
	};

}



export const get = async (context: vscode.ExtensionContext): Promise<Service> => {
	return Service.get(context);
};
