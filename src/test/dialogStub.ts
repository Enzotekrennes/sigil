/**
 * Test helper: gives jsdom's `<dialog>` the `showModal` and `close` methods it
 * lacks, behaving as a browser does for what the tests observe (the `open`
 * attribute, and a `close` event once closed). The top layer, the backdrop
 * and the inertness of the page are not emulated.
 *
 * Exposes `stubNativeDialog`. Used by test files only; never imported by the app.
 */

/**
 * Installs the two methods on `HTMLDialogElement.prototype`, once per test
 * environment (later calls leave them as they are).
 */
export function stubNativeDialog(): void {
  const prototype = HTMLDialogElement.prototype as Partial<
    Pick<HTMLDialogElement, 'showModal' | 'close'>
  >;
  if (typeof prototype.showModal === 'function') return;
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    },
  });
}
