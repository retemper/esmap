/**
 * Legacy Settings MFE — Vanilla JS + @esmap/compat migration demonstration.
 *
 * Demo points:
 * - Vanilla JS lifecycle (direct DOM manipulation without React)
 * - Displays the conversion of existing MF config to import map via @esmap/compat
 * - Framework agnostic: esmap supports React, Vue, and Vanilla JS
 */
import { convertMfToImportMap, convertMfSharedToImports } from '@esmap/compat';
import { legacyMfRemotes, legacyMfShared } from './mf-config.js';

/** bootstrap lifecycle */
export async function bootstrap(): Promise<void> {
  console.log('[legacy-settings] bootstrap');
}

/** mount lifecycle — Vanilla JS DOM rendering */
export async function mount(container: HTMLElement): Promise<void> {
  // ─── MF -> Import Map conversion demonstration ───
  const convertedImportMap = convertMfToImportMap(legacyMfRemotes, {
    cdnBase: 'https://cdn.new.example.com',
  });

  const convertedShared = convertMfSharedToImports(legacyMfShared, 'https://cdn.new.example.com');

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <h1 style="font-size:24px;font-weight:700;margin:0">Settings (Legacy Migration)</h1>
      <p style="color:#64748b;margin:0;font-size:14px">
        Vanilla JS MFE + @esmap/compat migration demo — works without React
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- Original MF config -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#dc2626">
            Before: Module Federation
          </h3>
          <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0">
            Webpack MF remote config (${legacyMfRemotes.length} remotes, ${Object.keys(legacyMfShared).length} shared)
          </p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(legacyMfRemotes, null, 2)}</pre>
          <h4 style="margin:12px 0 8px 0;font-size:13px;color:#475569">Shared Dependencies</h4>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(legacyMfShared, null, 2)}</pre>
        </div>

        <!-- Converted Import Map -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#16a34a">
            After: Import Map (W3C Standard)
          </h3>
          <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0">
            convertMfToImportMap() conversion result
          </p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(convertedImportMap, null, 2)}</pre>
          <h4 style="margin:12px 0 8px 0;font-size:13px;color:#475569">Shared → Import Map</h4>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(convertedShared, null, 2)}</pre>
        </div>
      </div>

      <!-- Settings form (Vanilla JS) -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
        <h3 style="margin:0 0 16px 0;font-size:16px">General Settings</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
            <input type="checkbox" id="setting-dark-mode" />
            Dark Mode (demo)
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
            <input type="checkbox" id="setting-notifications" checked />
            Enable Notifications
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px">
            <span>Language</span>
            <select id="setting-locale" style="padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0;font-size:14px">
              <option value="ko" selected>Korean</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </select>
          </label>
        </div>
      </div>

      <div style="padding:12px;background:#f8fafc;border-radius:6px;font-size:12px;color:#94a3b8;text-align:center">
        This MFE is implemented in Vanilla JS without React — demonstrating esmap's framework agnosticism
      </div>
    </div>
  `;

  // Vanilla JS event binding
  const darkModeCheckbox = container.querySelector<HTMLInputElement>('#setting-dark-mode');
  darkModeCheckbox?.addEventListener('change', () => {
    console.log(`[legacy-settings] dark mode: ${darkModeCheckbox.checked}`);
  });

  const localeSelect = container.querySelector<HTMLSelectElement>('#setting-locale');
  localeSelect?.addEventListener('change', () => {
    console.log(`[legacy-settings] locale: ${localeSelect.value}`);
  });
}

/** unmount lifecycle */
export async function unmount(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
}
