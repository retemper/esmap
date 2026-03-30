/**
 * esmap DevTools Background Service Worker.
 *
 * Routes messages between content script and DevTools panel.
 * Since MV3 uses service workers, state is minimized
 * and communication occurs only through port connections.
 */

/** Per-tab port routing table */
const contentPorts = new Map<number, chrome.runtime.Port>();
const panelPorts = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  const tabId = port.sender?.tab?.id;

  if (port.name === 'content-script' && tabId !== undefined) {
    // Register content script port
    contentPorts.set(tabId, port);

    port.onMessage.addListener((msg) => {
      // Forward Content -> Panel
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
    // Register panel port — tabId is sent separately by the panel
    const panelState = { tabId: -1 };

    port.onMessage.addListener((msg) => {
      if (msg.type === 'PANEL_INIT' && typeof msg.tabId === 'number') {
        // Panel informs which tab ID it monitors
        panelState.tabId = msg.tabId;
        panelPorts.set(panelState.tabId, port);

        // Forward snapshot request to the connected content script
        const content = contentPorts.get(panelState.tabId);
        if (content) {
          try { content.postMessage({ payload: { type: 'ESMAP_GET_SNAPSHOT' } }); } catch { /* empty */ }
        }
        return;
      }

      // Forward Panel -> Content
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
