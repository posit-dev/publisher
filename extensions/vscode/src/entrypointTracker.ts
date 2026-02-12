// Copyright (C) 2023 by Posit Software, PBC.

import {
  Disposable,
  NotebookDocument,
  NotebookEditor,
  TextDocument,
  TextEditor,
  commands,
  window,
  workspace,
} from "vscode";
import { Utils as uriUtils } from "vscode-uri";

import { useApi } from "src/api";
import { Contexts } from "src/constants";
import {
  getPythonInterpreterPath,
  getRInterpreterPath,
} from "src/utils/vscode";
import { isActiveDocument, relativeDir } from "src/utils/files";
import { hasKnownContentType } from "src/utils/inspect";
import {
  getSummaryStringFromError,
  isConnectionRefusedError,
} from "src/utils/errors";

function isTextEditor(
  editor: TextEditor | NotebookEditor,
): editor is TextEditor {
  return Object.hasOwn(editor, "document");
}

/**
 * Determines if a text document is an entrypoint file.
 *
 * @param document The text document to inspect
 * @returns If the text document is an entrypoint
 */
async function isDocumentEntrypoint(
  document: TextDocument | NotebookDocument,
): Promise<boolean> {
  const dir = relativeDir(document.uri);
  // If the file is outside the workspace, it cannot be an entrypoint
  if (dir === undefined) {
    return false;
  }

  try {
    const api = await useApi();
    const python = await getPythonInterpreterPath();
    const r = await getRInterpreterPath();

    const response = await api.configurations.inspect(dir, python, r, {
      entrypoint: uriUtils.basename(document.uri),
    });

    return hasKnownContentType(response.data);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "entrypointTracker::isDocumentEntrypoint",
      error,
    );
    // Don't show popup for connection errors - this is a transient state
    // that occurs during backend startup/shutdown. Just log to console.
    if (!isConnectionRefusedError(error)) {
      window.showErrorMessage(summary);
    }
    return false;
  }
}

/**
 * Tracks whether a document is an entrypoint file and sets extension context.
 */
export class TrackedEntrypointDocument {
  readonly document: TextDocument | NotebookDocument;
  private isEntrypoint: boolean;

  private requiresUpdate: boolean = false;

  private constructor(
    document: TextDocument | NotebookDocument,
    isEntrypoint: boolean,
  ) {
    this.document = document;
    this.isEntrypoint = isEntrypoint;
  }

  static async create(document: TextDocument | NotebookDocument) {
    const isEntrypoint = await isDocumentEntrypoint(document);
    return new TrackedEntrypointDocument(document, isEntrypoint);
  }

  /**
   * Sets the file entrypoint context with this as the active file.
   * @param options Options for the activation
   * @param options.forceUpdate Whether to force the entrypoint to update
   */
  async activate(options?: { forceUpdate?: boolean }) {
    // change based on if entrypoint
    if (options?.forceUpdate) {
      await this.update();
    } else if (this.requiresUpdate) {
      await this.update();
    }

    commands.executeCommand(
      "setContext",
      Contexts.ActiveFileEntrypoint,
      this.isEntrypoint,
    );
  }

  /**
   * Updates the entrypoint next time the document is activated.
   */
  updateNextActivate() {
    this.requiresUpdate = true;
  }

  /**
   * Updates whether or not the document is an entrypoint file.
   */
  private async update() {
    this.requiresUpdate = false;
    this.isEntrypoint = await isDocumentEntrypoint(this.document);
  }
}

/**
 * Tracks active documents and assists in determining extension context.
 */
export class DocumentTracker implements Disposable {
  private disposable: Disposable;

  private readonly documents = new Map<
    TextDocument | NotebookDocument,
    TrackedEntrypointDocument
  >();

  constructor() {
    this.disposable = Disposable.from(
      // Track text editors
      window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this),
      workspace.onDidCloseTextDocument(this.onDocumentClosed, this),
      workspace.onDidSaveTextDocument(this.onDocumentSaved, this),

      // Track notebook editors
      window.onDidChangeActiveNotebookEditor(this.onActiveEditorChanged, this),
      workspace.onDidCloseNotebookDocument(this.onDocumentClosed, this),
      workspace.onDidSaveNotebookDocument(this.onDocumentSaved, this),
    );

    // activate the initial active file
    this.onActiveEditorChanged(window.activeTextEditor);
    this.onActiveEditorChanged(window.activeNotebookEditor);
  }

  dispose() {
    this.disposable.dispose();
    this.documents.clear();
  }

  /**
   * Starts tracking a document
   * @param document The document to track
   * @returns The TrackedEntrypointDocument created
   */
  async addDocument(document: TextDocument | NotebookDocument) {
    const entrypoint = await TrackedEntrypointDocument.create(document);
    this.documents.set(document, entrypoint);
    return entrypoint;
  }

  /**
   * Stops tracking a document
   * @param document The document to stop tracking
   */
  removeDocument(document: TextDocument | NotebookDocument) {
    this.documents.delete(document);
  }

  /**
   * Listener function for changes to the active Text or Notebook Editor.
   *
   * Adds new documents to the tracker, and activates the associated
   * TrackedEntrypointDocument
   * @param editor The active editor
   */
  async onActiveEditorChanged(editor: TextEditor | NotebookEditor | undefined) {
    if (editor === undefined) {
      commands.executeCommand(
        "setContext",
        Contexts.ActiveFileEntrypoint,
        undefined,
      );
      return;
    }

    const document = isTextEditor(editor) ? editor.document : editor.notebook;

    let tracked = this.documents.get(document);

    if (tracked === undefined) {
      tracked = await this.addDocument(document);
    }

    tracked.activate();
  }

  /**
   * Listener function for the closing of a document.
   * Stops the document from being tracked.
   *
   * @param document The closed document
   */
  onDocumentClosed(document: TextDocument | NotebookDocument) {
    this.removeDocument(document);
  }

  /**
   * Listener function for the saving of a document.
   * Triggers the document to update next time it is activated.
   *
   * @param document The saved document
   */
  async onDocumentSaved(document: TextDocument | NotebookDocument) {
    const tracked = this.documents.get(document);

    if (tracked) {
      if (isActiveDocument(document)) {
        tracked.activate({ forceUpdate: true });
      } else {
        tracked.updateNextActivate();
      }
      return;
    }

    // Track the untracked document
    const newTracked = await this.addDocument(document);
    if (isActiveDocument(document)) {
      newTracked.activate();
    }
  }
}
