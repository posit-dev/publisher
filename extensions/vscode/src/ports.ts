import getPort = require('get-port');

export const acquire = async (): Promise<number> => {
  return getPort();
};
