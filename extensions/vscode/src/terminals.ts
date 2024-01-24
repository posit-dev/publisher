import * as vscode from 'vscode';

export class Terminal implements vscode.Disposable {

    private terminal: vscode.Terminal | undefined;

    get (): vscode.Terminal {
        if (this.terminal === undefined) {
            this.terminal = vscode.window.createTerminal({ hideFromUser: false });
            // register callbacks
            vscode.window.onDidCloseTerminal(() => {
                this.terminal = undefined;
            });
        }
        return this.terminal;
    }

    dispose(): void  {
        if (this.terminal !== undefined) {
            this.terminal.dispose();
        }
    }
}
