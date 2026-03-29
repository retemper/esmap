/**
 * Legacy Settings MFE — Vanilla JS + @esmap/compat 마이그레이션 시연.
 *
 * 시연 포인트:
 * - Vanilla JS 라이프사이클 (React 없이 직접 DOM 조작)
 * - @esmap/compat로 기존 MF 설정을 import map으로 변환하여 표시
 * - 프레임워크 무관성: esmap은 React, Vue, Vanilla JS 모두 지원
 */
import { convertMfToImportMap, convertMfSharedToImports } from '@esmap/compat';
import { legacyMfRemotes, legacyMfShared } from './mf-config.js';

/** bootstrap 라이프사이클 */
export async function bootstrap(): Promise<void> {
  console.log('[legacy-settings] bootstrap');
}

/** mount 라이프사이클 — Vanilla JS DOM 렌더링 */
export async function mount(container: HTMLElement): Promise<void> {
  // ─── MF → Import Map 변환 시연 ───
  const convertedImportMap = convertMfToImportMap(legacyMfRemotes, {
    cdnBase: 'https://cdn.new.example.com',
  });

  const convertedShared = convertMfSharedToImports(legacyMfShared, 'https://cdn.new.example.com');

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <h1 style="font-size:24px;font-weight:700;margin:0">Settings (Legacy Migration)</h1>
      <p style="color:#64748b;margin:0;font-size:14px">
        Vanilla JS MFE + @esmap/compat 마이그레이션 데모 — React 없이 동작합니다
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- 기존 MF 설정 -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#dc2626">
            Before: Module Federation
          </h3>
          <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0">
            Webpack MF remote 설정 (${legacyMfRemotes.length}개 remote, ${Object.keys(legacyMfShared).length}개 shared)
          </p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(legacyMfRemotes, null, 2)}</pre>
          <h4 style="margin:12px 0 8px 0;font-size:13px;color:#475569">Shared Dependencies</h4>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(legacyMfShared, null, 2)}</pre>
        </div>

        <!-- 변환된 Import Map -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#16a34a">
            After: Import Map (W3C Standard)
          </h3>
          <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0">
            convertMfToImportMap() 변환 결과
          </p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(convertedImportMap, null, 2)}</pre>
          <h4 style="margin:12px 0 8px 0;font-size:13px;color:#475569">Shared → Import Map</h4>
          <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap">${JSON.stringify(convertedShared, null, 2)}</pre>
        </div>
      </div>

      <!-- 설정 폼 (Vanilla JS) -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
        <h3 style="margin:0 0 16px 0;font-size:16px">일반 설정</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
            <input type="checkbox" id="setting-dark-mode" />
            다크 모드 (데모)
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
            <input type="checkbox" id="setting-notifications" checked />
            알림 활성화
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px">
            <span>언어</span>
            <select id="setting-locale" style="padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0;font-size:14px">
              <option value="ko" selected>한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
        </div>
      </div>

      <div style="padding:12px;background:#f8fafc;border-radius:6px;font-size:12px;color:#94a3b8;text-align:center">
        이 MFE는 React 없이 Vanilla JS로 구현되었습니다 — esmap의 프레임워크 무관성 시연
      </div>
    </div>
  `;

  // Vanilla JS 이벤트 바인딩
  const darkModeCheckbox = container.querySelector<HTMLInputElement>('#setting-dark-mode');
  darkModeCheckbox?.addEventListener('change', () => {
    console.log(`[legacy-settings] dark mode: ${darkModeCheckbox.checked}`);
  });

  const localeSelect = container.querySelector<HTMLSelectElement>('#setting-locale');
  localeSelect?.addEventListener('change', () => {
    console.log(`[legacy-settings] locale: ${localeSelect.value}`);
  });
}

/** unmount 라이프사이클 */
export async function unmount(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
}
