/*
 * Applies the theme the visitor picked before the page is first painted, so a
 * stored "gold on black" (or "ink on paper" against a dark system) never shows
 * a flash of the other theme while the app loads.
 *
 * Loaded by index.html as a blocking classic script from the site's own
 * origin: the Content-Security-Policy (script-src 'self') forbids inline
 * scripts. Mirrors src/app/theme.ts, which takes over once the app has
 * started: same localStorage key, same two accepted values ("light",
 * "dark"); anything else leaves the page on the system setting. Reads
 * storage only, never writes it.
 */
/* global document, window */
(function applyStoredTheme() {
  try {
    const theme = window.localStorage.getItem('sigil.theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {
    // Storage blocked by the browser: the page follows the system setting.
  }
})();
