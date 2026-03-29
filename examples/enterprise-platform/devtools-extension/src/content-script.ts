/**
 * esmap DevTools Content Script.
 *
 * 페이지의 postMessage와 extension background 사이의 브릿지.
 * 페이지 코드가 직접 postMessage로 이벤트를 브로드캐스트하므로
 * 별도의 page-hook 주입이 필요 없다.
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
