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
export class TrackedEntrypointDocument implements Disposable {
  readonly document: TextDocument;
  private isEntrypoint: boolean;

  private constructor(document: TextDocument, isEntrypoint: boolean) {
    this.document = document;
    this.isEntrypoint = isEntrypoint;
  }

  static async create(document: TextDocument) {
    // set entrypoint with API call
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

  dispose() {
    return;
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
    );
  }

  dispose() {
    this.disposable.dispose();

    this.documents.forEach((doc) => doc.dispose());
    this.documents.clear();
  }

  /**
   * Adds a document to be tracked
   * @param document The document to track
   * @returns The document passed
   */
  async addDocument(document: TextDocument) {
    const entrypoint = await TrackedEntrypointDocument.create(document);
    this.documents.set(document, entrypoint);
    return document;
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
      console.log("ACTIVE FILE undefined");
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

    console.log(
      "ACTIVE FILE EDITOR CHANGED",
      workspace.asRelativePath(editor.document.uri),
    );
  }
}
