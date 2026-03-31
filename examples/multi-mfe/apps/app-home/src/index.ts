/**
 * Home MFE — main dashboard activated at the "/" route.
 * Sets __HOME_APP_DATA__ on the sandbox proxy for sandbox isolation verification.
 */

declare global {
  interface Window {
    __ESMAP_SANDBOXES__?: Map<string, { proxy: Record<string, unknown> }>;
  }
}

/** Gets the app's sandbox proxy. Returns window if not available. */
function getSandboxProxy(): Record<string, unknown> {
  const sandbox = window.__ESMAP_SANDBOXES__?.get('app-home');
  return sandbox?.proxy ?? (window as unknown as Record<string, unknown>);
}

/** App bootstrap — initialization phase */
export function bootstrap(): Promise<void> {
  console.log('[app-home] bootstrap');
  return Promise.resolve();
}

/** App mount — set global variables and render dashboard */
export function mount(container: HTMLElement): Promise<void> {
  console.log('[app-home] mount');

  // Set global variable via sandbox proxy (prevents actual window pollution)
  const proxy = getSandboxProxy();
  proxy['__HOME_APP_DATA__'] = 'home-active';
  console.log('[app-home] sandbox.__HOME_APP_DATA__ = "home-active"');

  // Check if settings app's global variable leaks
  const settingsLeak = String(proxy['__SETTINGS_APP_DATA__'] ?? 'undefined (isolated)');
  console.log(`[app-home] sandbox.__SETTINGS_APP_DATA__ = ${settingsLeak}`);

  container.innerHTML = `
    <div style="padding:32px;">
      <h1>Home Dashboard</h1>
      <p style="color:#666;">This page is rendered by the <code>app-home</code> MFE.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;">
        <div style="background:#f0f7ff;padding:20px;border-radius:8px;">
          <h3>Employees</h3>
          <p style="font-size:2em;font-weight:bold;color:#1a73e8;">142</p>
        </div>
        <div style="background:#f0fff0;padding:20px;border-radius:8px;">
          <h3>Monthly Payroll</h3>
          <p style="font-size:2em;font-weight:bold;color:#0d904f;">₩ 1.2B</p>
        </div>
        <div style="background:#fff8f0;padding:20px;border-radius:8px;">
          <h3>Attendance Rate</h3>
          <p style="font-size:2em;font-weight:bold;color:#e67700;">96.4%</p>
        </div>
      </div>
      <div style="margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;font-family:monospace;font-size:13px;">
        <h4 style="margin:0 0 8px;">Sandbox Isolation Check</h4>
        <div>sandbox.__HOME_APP_DATA__ = "home-active" (via proxy)</div>
        <div>sandbox.__SETTINGS_APP_DATA__ = "${settingsLeak}"</div>
      </div>
    </div>
  `;
  return Promise.resolve();
}

/** App unmount — clean up global variables and reset DOM */
export function unmount(container: HTMLElement): Promise<void> {
  console.log('[app-home] unmount');
  const proxy = getSandboxProxy();
  delete proxy['__HOME_APP_DATA__'];
  container.innerHTML = '';
  return Promise.resolve();
}
