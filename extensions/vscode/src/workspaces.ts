import * as vscode from 'vscode';
import { win32, posix } from 'path';


export const path = (platform: string = process.platform): string | undefined => {
    let path = vscode.workspace.workspaceFolders?.at(0)?.uri.path;
    if (platform === 'win32') {
        // replace '/' with '\'
        path = path?.split(posix.sep).join(win32.sep);
        // remove leading '\'
        path = path?.slice(1);
    }
    return path;
};
