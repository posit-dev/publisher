import { debounce } from 'quasar';

export function requestOnce(fn, wait: number) {
  let controller: AbortController | undefined;

  return debounce((...args) => {
    if (controller) {
      controller.abort();
    }
    controller = new AbortController();
    fn(controller.signal, ...args);
  }, wait);
}
