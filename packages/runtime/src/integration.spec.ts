import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppRegistry } from './app-registry.js';
import { loadImportMap } from './loader.js';
import type { MfeApp, ImportMap } from '@esmap/shared';

/**
 * AppRegistry와 loadImportMap을 결합한 통합 테스트.
 * 실제 브라우저 시나리오에 가까운 동작을 검증한다.
 */
describe('런타임 통합 테스트', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<div id="nav"></div><div id="main"></div>';
    vi.restoreAllMocks();
  });

  it('import map 로드 → 앱 등록 → 상태 추적 전체 플로우', async () => {
    const importMap: ImportMap = {
      imports: {
        'app-nav': 'https://cdn.example.com/app-nav.js',
        'app-home': 'https://cdn.example.com/app-home.js',
      },
    };

    // 1. import map 로드
    const result = await loadImportMap({ inlineImportMap: importMap });
    expect(result).toStrictEqual(importMap);

    // import map이 DOM에 주입되었는지 확인
    const scriptTag = document.querySelector('script[type="importmap"]');
    expect(scriptTag).not.toBeNull();
    expect(JSON.parse(scriptTag!.textContent!)).toStrictEqual(importMap);

    // 2. modulepreload 힌트가 주입되었는지 확인
    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(2);

    // 3. 앱 등록
    const registry = new AppRegistry();
    const statusLog: string[] = [];

    registry.onStatusChange((event) => {
      statusLog.push(`${event.appName}:${event.from}→${event.to}`);
    });

    registry.registerApp({
      name: 'app-nav',
      activeWhen: () => true,
      container: '#nav',
    });

    registry.registerApp({
      name: 'app-home',
      activeWhen: '/',
      container: '#main',
    });

    expect(registry.getApps()).toHaveLength(2);
    expect(registry.getApp('app-nav')!.status).toBe('NOT_LOADED');
  });

  it('여러 앱의 마운트/언마운트 사이클', async () => {
    const registry = new AppRegistry();
    const events: string[] = [];

    registry.onStatusChange((event) => {
      events.push(`${event.appName}:${event.to}`);
    });

    // 앱 등록
    registry.registerApp({ name: 'app-a', activeWhen: '/a', container: '#main' });
    registry.registerApp({ name: 'app-b', activeWhen: '/b', container: '#main' });

    // dynamic import가 jsdom에서 실패하므로 LOAD_ERROR까지만 확인
    try {
      await registry.loadApp('app-a');
    } catch {
      // expected in jsdom
    }

    expect(events).toContain('app-a:LOADING');
    expect(events).toContain('app-a:LOAD_ERROR');

    // 앱 해제
    await registry.unregisterApp('app-a');
    expect(registry.getApp('app-a')).toBeUndefined();
    expect(registry.getApps()).toHaveLength(1);
  });

  it('import map 중복 주입 방지', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    // 첫 번째 로드
    await loadImportMap({ inlineImportMap: importMap });

    // 두 번째 로드 시 이미 import map이 있으므로 추가 주입하지 않음
    await loadImportMap({
      inlineImportMap: { imports: { vue: 'https://cdn.example.com/vue.js' } },
    });

    const scripts = document.querySelectorAll('script[type="importmap"]');
    expect(scripts).toHaveLength(1);
    // 첫 번째 import map만 유지됨
    expect(JSON.parse(scripts[0].textContent!)).toStrictEqual(importMap);
  });
});
