export class CancelController {
  private controller: AbortController | undefined;

  cancelPrevious<T>(fn: () => T): T {
    if (this.controller) {
      this.controller.abort();
    }
    this.controller = new AbortController();

    return fn();
  }

  get signal() {
    return this.controller?.signal;
  }
}
