/**
 * esmap DevTools Content Script.
 *
 * Bridge between the page's postMessage and extension background.
 * Since the page code broadcasts events directly via postMessage,
 * no separate page-hook injection is needed.
 */

const port = chrome.runtime.connect({ name: 'content-script' });

// Page → Extension
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== 'esmap-devtools') return;
  try {
    port.postMessage({ payload: event.data.payload });
  } catch { /* port disconnected */ }
});

// Extension → Page
port.onMessage.addListener((msg: { payload: Record<string, unknown> }) => {
  window.postMessage(
    { source: 'esmap-devtools-panel', payload: msg.payload },
    window.location.origin,
  );
});
