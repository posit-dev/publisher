const executable: string = "just run";
const command: string = "publish-ui";
const path: string = "test/sample-content/fastapi-simple";

export type Command = string;

export const create = (port: number): Command => {
    const url = `127.0.0.1:${port}`;
    return [
        executable,
        command,
        `--listen=${url}`,
        // Local storage is disabled in VSCode WebViews. See https://github.com/Microsoft/vscode/issues/48464.
        //
        // Therefore browser sessions authentication via cookies is not viable in a WebView.
        //
        // This extension has a defined "extensionType" of "ui". Therefore, this VSCode will only launch the extension when access to localhost. See https://code.visualstudio.com/api/advanced-topics/extension-host
        //
        // Therefore browser session authentication is not required.
        '--skip-browser-session-auth',
        path
    ].join(' ');
};
