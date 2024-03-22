// Copyright (C) 2023 by Posit Software, PBC.

export const vscode =
  typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : undefined;

export type VscodeTheme =
  | "light"
  | "dark"
  | "high-contrast-dark"
  | "high-contrast-light";

const themeFromClassList = (classes: DOMTokenList): VscodeTheme | undefined => {
  if (classes.contains("vscode-light")) {
    return "light";
  } else if (classes.contains("vscode-dark")) {
    return "dark";
  } else if (classes.contains("vscode-high-contrast")) {
    return "high-contrast-dark";
  } else if (classes.contains("vscode-high-contrast-light")) {
    return "high-contrast-light";
  }
};

export const getVscodeTheme = (): VscodeTheme | undefined => {
  return themeFromClassList(document.body.classList);
};

export const onVscodeThemeChange = (
  callback: (theme: VscodeTheme | undefined) => void,
) => {
  let lastTheme = getVscodeTheme();

  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        if (mutation.target instanceof Element) {
          const theme = themeFromClassList(mutation.target.classList);
          if (lastTheme !== theme) {
            callback(theme);
            lastTheme = theme;
            break;
          }
        }
      }
    }
  });

  observer.observe(document.body, { attributes: true });
  return observer;
};

export enum VSCodeCommandMessage {
  RELOAD_WEBVIEW = "reload-webview",
}
