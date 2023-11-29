import getPort = require('get-port');
import * as wait from 'wait-on';

import { HOST } from '.';

export const acquire = async (): Promise<number> => {
    return getPort();
};

export const ping = async (port: number, timeout: number = 30 * 1000): Promise<boolean> => {
    try {
        await wait({
            resources: [
                `http-get://${HOST}:${port}`
            ],
            timeout: timeout
        });
        return true;
    } catch (e) {
        console.warn("failed waiting for port", e);
        return false;
    }
};
