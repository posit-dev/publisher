import * as net from 'net';
import * as retry from 'retry';
import * as vscode from 'vscode';

import { HOST } from '.';

import * as commands from './commands';
import { Terminal } from './terminals';
import * as workspaces from './workspaces';

export class Server implements vscode.Disposable {

    readonly port: number;
    readonly terminal: Terminal;

    constructor(port: number) {
        this.port = port;
        this.terminal = new Terminal();
    }

    /**
     * Asynchronously starts the server.
     *
     * @param {vscode.ExtensionContext} context - The VSCode extension context.
     * @returns {Promise<void>} A Promise that resolves when the server starts.
     */
    async start(context: vscode.ExtensionContext): Promise<void> {
        if (await this.isDown()) {
            const message = vscode.window.setStatusBarMessage("Starting Posit Publisher. Please wait...");
            // todo - make this configurable
            const path = workspaces.path();
            const command: commands.Command = await commands.create(context, path!, this.port);
            this.terminal.get().sendText(command);
            await this.isUp();
            message.dispose();
        }
    }

    /**
     * Asynchronously stops the server.
     *
     * @async
     * @returns {Promise<void>} A Promise that resolves when the server stops.
     */
    async stop(): Promise<void> {
        const message = vscode.window.setStatusBarMessage("Stopping Posit Publisher. Please wait...");
        this.terminal.get().sendText("\u0003");
        await this.isDown();
        message.dispose();
    }

    /**
     * Disposes of the resources associated with the server.
     */
    dispose() {
        this.terminal.dispose();
    }

    /**
     * Checks if the server is up by attempting to establish a connection.
     * Retries the connection check using exponential backoff if it fails.
     *
     * @returns {Promise<boolean>} A Promise that resolves to `true` if the server is up, and rejects if all attempts fail.
     * @throws {Error} Will throw an error if the connection check encounters an error or reaches the maximum number of retries.
     */
    private async isUp(): Promise<boolean> {
        const operation = retry.operation();
        return new Promise(async (resolve, reject) => {
            // Attempt the operation with exponential backoff
            operation.attempt(async (attempt) => {
                try {
                    // Check if the server is running
                    const running = await this.check();
                    // Resolve the Promise indicating that the server is still up or down
                    resolve(running);
                } catch (error) {
                    // Check if the error is an instance of Error and if retry is possible
                    if (error instanceof Error && operation.retry(error)) {
                        console.error(`Attempt ${attempt} failed. Retrying...`);
                        return;
                    }
                    // Reject the Promise with the main error of the retry operation
                    reject(operation.mainError());
                }
            });
        });
    }

    /**
     * Checks if the server is down by attempting to establish a connection.
     * Retries the connection check using exponential backoff if it fails.
     *
     * @returns {Promise<boolean>} A Promise that resolves to `true` if the server is down, and rejects if all attempts fail.
     * @throws {Error} Will throw an error if the connection check encounters an error (excluding ECONNREFUSED) or reaches the maximum number of retries.
     */
    private async isDown(): Promise<boolean> {
        const operation = retry.operation();
        return new Promise(async (resolve, reject) => {
            // Attempt the operation with exponential backoff
            operation.attempt(async (attempt) => {
                try {
                    // Check if the server is running
                    const running = await this.check();
                    // Resolve the Promise indicating that the server is still up or down
                    resolve(!running);
                } catch (error) {
                    if (error instanceof Error) {
                        // Check if the error message indicates ECONNREFUSED
                        // This is what we want to happen when the server is down
                        if (error.message.includes("ECONNREFUSED")) {
                            // Resolve the Promise indicating that the server is down
                            resolve(true);
                            return;
                        }
                        // If retry is possible, log the attempt and continue
                        if (operation.retry(error)) {
                            console.error(`Attempt ${attempt} failed. Retrying...`);
                            return;
                        }
                    }
                    // Reject the Promise with the main error of the retry operation
                    reject(operation.mainError());
                }
            });
        });
    }

    /**
     * Checks the connection status to a server within a specified timeout.
     *
     * @param {number} [timeout=1000] - Timeout for the connection attempt in milliseconds.
     * @returns {Promise<boolean>} A Promise that resolves to `true` if the server is reachable within the timeout, resolves to `false` if the connection times out, and rejects if an error occurs.
     * @throws {Error} Will throw an error if the connection encounters an error or is closed with an error.
     */
    private async check(timeout: number = 1000): Promise<boolean> {
        return new Promise((resolve, reject) => {
            // Create a new socket
            const socket = new net.Socket();
            socket.setTimeout(timeout);

            // Event handler for successful connection
            socket.on('connect', () => {
                // Close the socket
                socket.end();
                // Resolve the Promise indicating successful connection
                resolve(true);
            });

            // Event handler for connection timeout
            socket.on('timeout', () => {
                // Destroy the socket
                socket.end();
                // Resolve the Promise indicating connection timeout
                resolve(true);
            });

            // Event handler for connection error
            socket.on('error', (error) => {
                // Destroy the socket
                socket.destroy();
                // Reject the Promise with the encountered error
                reject(error);
            });

            // Event handler for socket close
            socket.on('close', (error) => {
                // Check if the close event had an error
                if (error) {
                    // Reject the Promise with an error indicating connection closure with error
                    reject(new Error('Connection closed with error'));
                } else {
                    // Resolve the Promise indicating successful closure without error
                    resolve(true);
                }
            });

            // Initiate a connection to the specified host and port
            socket.connect(this.port, HOST);
        });
    }

}
