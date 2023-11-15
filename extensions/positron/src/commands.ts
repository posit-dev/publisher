const executable: string = "connect-client";

export type Command = string;

export const create = (path: string, port: number, subcommand: string = "publish-ui"): Command => {
    return `${executable} ${subcommand} --listen=127.0.0.1:${port} ${path}`;
};
