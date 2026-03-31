/**
 * esmap DevTools Page.
 *
 * Runs when Chrome DevTools opens and creates the "esmap" custom panel.
 */

chrome.devtools.panels.create(
  'esmap',         // Panel tab name
  '',              // Icon (empty string = default)
  'panel.html',    // Panel page URL
);
