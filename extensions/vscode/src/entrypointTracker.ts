// Copyright (C) 2023 by Posit Software, PBC.

import {
  Disposable,
  TextDocument,
  TextEditor,
  commands,
  window,
  workspace,
} from "vscode";
import { Utils as uriUtils } from "vscode-uri";

import { useApi } from "src/api";
import { Contexts } from "src/constants";
import { getPythonInterpreterPath } from "src/utils/config";
import { isActiveDocument, relativeDir } from "src/utils/files";
import { hasKnownContentType } from "src/utils/inspect";
import { getSummaryStringFromError } from "src/utils/errors";

/**
 * Determines if a text document is an entrypoint file.
 *
 * @param document The text document to inspect
 * @returns If the text document is an entrypoint
 */
async function isDocumentEntrypoint(document: TextDocument): Promise<boolean> {
  try {
    const api = await useApi();
    const python = await getPythonInterpreterPath();

    const dir = relativeDir(document.uri);
    // If the file is outside the workspace, it cannot be an entrypoint
    if (dir === undefined) {
      return false;
    }

    const response = await api.configurations.inspect(python, {
      dir: dir,
      entrypoint: uriUtils.basename(document.uri),
    });
    return hasKnownContentType(response.data);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "entrypointTracker::isDocumentEntrypoint",
      error,
    );
    window.showInformationMessage(summary);
    return false;
  }
}

/**
 * Tracks whether a document is an entrypoint file and sets extension context.
 */
export class TrackedEntrypointDocument {
  readonly document: TextDocument;
  private isEntrypoint: boolean;

  private requiresUpdate: boolean = false;

  private constructor(document: TextDocument, isEntrypoint: boolean) {
    this.document = document;
    this.isEntrypoint = isEntrypoint;
  }

  static async create(document: TextDocument) {
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
    TextDocument,
    TrackedEntrypointDocument
  >();

  constructor() {
    this.disposable = Disposable.from(
      window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this),
      workspace.onDidCloseTextDocument(this.onTextDocumentClosed, this),
      workspace.onDidSaveTextDocument(this.onTextDocumentSaved, this),
    );

    // activate the initial active file
    this.onActiveTextEditorChanged(window.activeTextEditor);
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
  async addDocument(document: TextDocument) {
    const entrypoint = await TrackedEntrypointDocument.create(document);
    this.documents.set(document, entrypoint);
    return entrypoint;
  }

  /**
   * Stops tracking a document
   * @param document The document to stop tracking
   */
  removeDocument(document: TextDocument) {
    this.documents.delete(document);
  }

  /**
   * Listener function for changes to the active text editor.
   *
   * Adds new documents to the tracker, and activates the associated
   * TrackedEntrypointDocument
   * @param editor The active text editor
   */
  async onActiveTextEditorChanged(editor: TextEditor | undefined) {
    if (editor === undefined) {
      commands.executeCommand(
        "setContext",
        Contexts.ActiveFileEntrypoint,
        undefined,
      );
      return;
    }

    let tracked = this.documents.get(editor.document);

    if (tracked === undefined) {
      tracked = await this.addDocument(editor.document);
    }

    tracked.activate();
  }

  /**
   * Listener function for the closing of a text document.
   * Stops the document from being tracked.
   *
   * @param document The closed document
   */
  onTextDocumentClosed(document: TextDocument) {
    this.removeDocument(document);
  }

  /**
   * Listener function for the saving of a text document.
   * Triggers the document to update next time it is activated.
   *
   * @param document The saved document
   */
  async onTextDocumentSaved(document: TextDocument) {
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
