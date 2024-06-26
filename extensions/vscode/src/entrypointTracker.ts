import {
  Disposable,
  TextDocument,
  TextEditor,
  commands,
  window,
  workspace,
} from "vscode";

const ACTIVE_FILE_ENTRYPOINT_CONTEXT = "posit.publish.activeFileEntrypoint";

/**
 * Tracks whether a document is an entrypoint file and sets extension context.
 */
export class TrackedEntrypointDocument {
  readonly document: TextDocument;
  private isEntrypoint: boolean;

  private constructor(document: TextDocument, isEntrypoint: boolean) {
    this.document = document;
    this.isEntrypoint = isEntrypoint;
  }

  static async create(document: TextDocument) {
    // set entrypoint with API call
    // workspace.asRelativePath(editor.document.uri),
    return new TrackedEntrypointDocument(document, false);
  }

  /**
   * Sets the file entrypoint context with this as the active file
   */
  activate() {
    // change based on if entrypoint
    commands.executeCommand(
      "setContext",
      ACTIVE_FILE_ENTRYPOINT_CONTEXT,
      this.isEntrypoint,
    );
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
   * @returns The document passed
   */
  async addDocument(document: TextDocument) {
    const entrypoint = await TrackedEntrypointDocument.create(document);
    this.documents.set(document, entrypoint);
    return document;
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
        ACTIVE_FILE_ENTRYPOINT_CONTEXT,
        undefined,
      );
      return;
    }

    let tracked = this.documents.get(editor.document);

    if (tracked === undefined) {
      await this.addDocument(editor.document);
      tracked = this.documents.get(editor.document);
    }

    tracked?.activate();
  }

  /**
   * Listener function for the closing of a text document.
   * @param document The closed document
   */
  onTextDocumentClosed(document: TextDocument) {
    this.removeDocument(document);
  }
}
