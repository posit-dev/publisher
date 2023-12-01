// Copyright (C) 2023 by Posit Software, PBC.

import { Account } from 'src/api';

export const calculateName = (account: Account) => {
  if (account.authType === 'token-key') {
    return account.accountName;
  } else if (account.authType === 'api-key') {
    return 'Using API Key';
  }
  return '';
};
