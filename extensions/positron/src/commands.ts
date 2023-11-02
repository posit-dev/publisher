const executable: string = "just run";

export type Command = string;

export const create = (port: number, subcommand: string = "publish-ui"): Command => {
    return `${executable} ${subcommand} --listen=127.0.0.1:${port} test/sample-content/fastapi-simple --skip-browser-session-auth`;
};
