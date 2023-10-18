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

export const findAccount = (accountName: string, accounts: Account[]): Account | undefined => {
  return accounts.find(account => {
    return (account.name === accountName);
  });
};
