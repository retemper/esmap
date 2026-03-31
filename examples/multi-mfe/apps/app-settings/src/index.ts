/**
 * Settings MFE — settings page activated at the "/settings" route.
 * Sets __SETTINGS_APP_DATA__ on the sandbox proxy for sandbox isolation verification.
 */

declare global {
  interface Window {
    __ESMAP_SANDBOXES__?: Map<string, { proxy: Record<string, unknown> }>;
  }
}

/** Gets the app's sandbox proxy. Returns window if not available. */
function getSandboxProxy(): Record<string, unknown> {
  const sandbox = window.__ESMAP_SANDBOXES__?.get('app-settings');
  return sandbox?.proxy ?? (window as unknown as Record<string, unknown>);
}

/** App bootstrap — initialization phase */
export function bootstrap(): Promise<void> {
  console.log('[app-settings] bootstrap');
  return Promise.resolve();
}

/** App mount — set global variables and render settings UI */
export function mount(container: HTMLElement): Promise<void> {
  console.log('[app-settings] mount');

  // Set global variable via sandbox proxy (prevents actual window pollution)
  const proxy = getSandboxProxy();
  proxy['__SETTINGS_APP_DATA__'] = 'settings-active';
  console.log('[app-settings] sandbox.__SETTINGS_APP_DATA__ = "settings-active"');

  // Check if home app's global variable leaks
  const homeLeak = String(proxy['__HOME_APP_DATA__'] ?? 'undefined (isolated)');
  console.log(`[app-settings] sandbox.__HOME_APP_DATA__ = ${homeLeak}`);

  container.innerHTML = `
    <div style="padding:32px;">
      <h1>Settings</h1>
      <p style="color:#666;">This page is rendered by the <code>app-settings</code> MFE.</p>
      <div style="margin-top:24px;max-width:480px;">
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:12px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>Dark Mode</span>
            <input type="checkbox" />
          </label>
        </div>
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:12px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>Enable Notifications</span>
            <input type="checkbox" checked />
          </label>
        </div>
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>Language</span>
            <select>
              <option>Korean</option>
              <option>English</option>
              <option>日本語</option>
            </select>
          </label>
        </div>
      </div>
      <div style="margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;font-family:monospace;font-size:13px;">
        <h4 style="margin:0 0 8px;">Sandbox Isolation Check</h4>
        <div>sandbox.__SETTINGS_APP_DATA__ = "settings-active" (via proxy)</div>
        <div>sandbox.__HOME_APP_DATA__ = "${homeLeak}"</div>
      </div>
    </div>
  `;
  return Promise.resolve();
}

/** App unmount — clean up global variables and reset DOM */
export function unmount(container: HTMLElement): Promise<void> {
  console.log('[app-settings] unmount');
  const proxy = getSandboxProxy();
  delete proxy['__SETTINGS_APP_DATA__'];
  container.innerHTML = '';
  return Promise.resolve();
}
