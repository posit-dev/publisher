import { debounce } from 'quasar';

type SignalFn = (signal: AbortSignal, ...args: unknown[]) => unknown;
type ExcludeSignal<T extends unknown[]> = T extends [AbortSignal, ...infer P] ? P : never;

export function requestOnce<F extends SignalFn>(
  fn: F,
  wait: number
): (...args: ExcludeSignal<Parameters<F>>) => void {
  let controller: AbortController | undefined;

  return debounce((...args) => {
    if (controller) {
      controller.abort();
    }
    controller = new AbortController();
    fn(controller.signal, ...args);
  }, wait);
}
