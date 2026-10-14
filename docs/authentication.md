---
title: "Using Publisher Credentials from Other Extensions"
---

Posit Publisher registers an authentication provider with VS Code and
Positron. Other extensions can use it to call the Posit Connect API with
credentials the user has already added in Publisher, or to ask the user to
sign in to a Connect server. Your credentials also appear in the Accounts menu
of VS Code and Positron, where you can sign in to a new server or sign out of
an existing one.

This page is for extension authors.

## Getting a session

The provider id is `posit-connect`. Use the standard
[`vscode.authentication`](https://code.visualstudio.com/api/references/vscode-api#authentication)
API:

```typescript
import * as vscode from "vscode";

const session = await vscode.authentication.getSession(
  "posit-connect",
  ["https://connect.example.com"],
  { createIfNone: true },
);

const scheme = session.scopes.includes("auth-scheme:Bearer") ? "Bearer" : "Key";
const response = await fetch(`${session.account.id}/__api__/v1/user`, {
  headers: { Authorization: `${scheme} ${session.accessToken}` },
});
```

Each session describes one Publisher credential:

| Field           | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| `id`            | The credential's unique identifier.                          |
| `account.id`    | The Connect server URL.                                      |
| `account.label` | The credential's name.                                       |
| `accessToken`   | An API key or an OAuth access token.                         |
| `scopes`        | `Publisher`, plus `auth-scheme:Key` or `auth-scheme:Bearer`. |

The `auth-scheme:` scope tells you how to send `accessToken` to Connect:

- `auth-scheme:Key`: send `Authorization: Key <accessToken>` (an API key).
- `auth-scheme:Bearer`: send `Authorization: Bearer <accessToken>` (an OAuth
  access token from browser sign-in).

## Choosing a server

The provider picks which credentials to return as follows:

1. If you pass `options.account`, only the credential for that account is
   returned. Accounts come from
   `vscode.authentication.getAccounts("posit-connect")`, and each account's
   `id` is a Connect server URL.
2. Otherwise, if one of the scopes is a URL (starting with `http://` or
   `https://`), only credentials for that server are returned. Matching ignores
   case and a trailing slash.
3. Otherwise, all Connect credentials are returned, and VS Code asks the user
   to pick one if there is more than one.

Any other scopes are ignored.

## Signing in

When no matching credential exists and you pass `createIfNone: true` (or
`forceNewSession`), Publisher opens its New Credential flow, pre-filled with
the server URL from `options.account` or the URL scope. The user signs in with
their browser. If the user cancels, `getSession` rejects.

The same flow runs when the user chooses **Sign in with Posit Connect** from
the Accounts menu.

## Token lifetime

OAuth access tokens from browser sign-in expire. Publisher refreshes a token
when you request a session and the token has expired or is about to expire,
and then fires `onDidChangeSessions`. If you hold on to a session, listen for
that event, or call `getSession` again before each batch of requests. If
Connect returns `401 Unauthorized`, call `getSession` again with
`forceNewSession` to ask the user to sign in again.

API keys don't expire on their own.

## Which credentials are shared

Only Posit Connect credentials that use an API key or browser (OAuth) sign-in
become sessions. These credentials are not shared:

- Credentials created with the older browser sign-in that uses a token and a
  private key. Each request is signed, so there is no token to share.
  Re-create the credential with an API key, or with browser sign-in on Posit
  Connect 2026.02.0 or later, to share it.
- Posit Connect Cloud credentials.
- Posit Connect credentials for Snowflake.

## Signing out

Choosing **Sign Out** for a Posit Connect account in the Accounts menu deletes
that credential from Publisher. Deployments that used it will need a new
credential before you can redeploy them.
