/**
 * esmap DevTools Background Service Worker.
 *
 * Content script ↔ DevTools panel 간 메시지를 라우팅한다.
 * MV3에서는 service worker이므로 상태를 최소화하고
 * 포트 연결을 통해서만 통신한다.
 */

/** 탭별 포트 라우팅 테이블 */
const contentPorts = new Map<number, chrome.runtime.Port>();
const panelPorts = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  const tabId = port.sender?.tab?.id;

  if (port.name === 'content-script' && tabId !== undefined) {
    // Content script 포트 등록
    contentPorts.set(tabId, port);

    port.onMessage.addListener((msg) => {
      // Content → Panel 전달
      const panel = panelPorts.get(tabId);
      if (panel) {
        try { panel.postMessage(msg); } catch { /* disconnected */ }
      }
    });

    port.onDisconnect.addListener(() => {
      contentPorts.delete(tabId);
    });
  }

  if (port.name === 'devtools-panel') {
    // Panel 포트 등록 — tabId는 panel에서 별도 전송
    const panelState = { tabId: -1 };

    port.onMessage.addListener((msg) => {
      if (msg.type === 'PANEL_INIT' && typeof msg.tabId === 'number') {
        // Panel이 자신이 감시할 탭 ID를 알려준다
        panelState.tabId = msg.tabId;
        panelPorts.set(panelState.tabId, port);

        // 연결된 content script에 스냅샷 요청 전달
        const content = contentPorts.get(panelState.tabId);
        if (content) {
          try { content.postMessage({ payload: { type: 'ESMAP_GET_SNAPSHOT' } }); } catch { /* empty */ }
        }
        return;
      }

      // Panel → Content 전달
      if (panelState.tabId >= 0) {
        const content = contentPorts.get(panelState.tabId);
        if (content) {
          try { content.postMessage(msg); } catch { /* empty */ }
        }
      }
    });

    port.onDisconnect.addListener(() => {
      if (panelState.tabId >= 0) {
        panelPorts.delete(panelState.tabId);
      }
    });
  }
});
