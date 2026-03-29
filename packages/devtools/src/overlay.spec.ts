/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDevtoolsOverlay } from './overlay.js';
import type { DevtoolsOverlay, OverlayAppInfo } from './overlay.js';

/** 테스트용 오버레이 인스턴스를 관리한다. */
const refs: { overlay: DevtoolsOverlay | null } = { overlay: null };

/** data-esmap-devtools 속성으로 오버레이 루트 요소를 조회한다. */
function getOverlayElement(): HTMLElement | null {
  return document.querySelector('[data-esmap-devtools="overlay"]');
}

/** 테스트용 앱 정보 목록을 생성한다. */
function createSampleApps(): readonly OverlayAppInfo[] {
  return [
    { name: 'app-a', status: 'MOUNTED', container: '#root-a', perfDuration: 120 },
    { name: 'app-b', status: 'LOAD_ERROR', container: '#root-b' },
    { name: 'app-c', status: 'NOT_LOADED', container: '#root-c', perfDuration: 0 },
  ];
}

/** KeyboardEvent를 생성하여 dispatch한다. */
function dispatchKeydown(options: KeyboardEventInit): void {
  const event = new KeyboardEvent('keydown', options);
  document.dispatchEvent(event);
}

describe('createDevtoolsOverlay', () => {
  beforeEach(() => {
    refs.overlay?.destroy();
    refs.overlay = null;
  });

  it('오버레이가 document.body에 추가된다', () => {
    refs.overlay = createDevtoolsOverlay();

    const el = getOverlayElement();
    expect(el).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);
  });

  it('초기 상태에서 숨겨져 있다', () => {
    refs.overlay = createDevtoolsOverlay();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('none');
    expect(refs.overlay.visible).toBe(false);
  });

  it('show()가 오버레이를 표시한다', () => {
    refs.overlay = createDevtoolsOverlay();

    refs.overlay.show();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('block');
    expect(refs.overlay.visible).toBe(true);
  });

  it('hide()가 오버레이를 숨긴다', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.show();

    refs.overlay.hide();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('none');
    expect(refs.overlay.visible).toBe(false);
  });

  it('toggle()이 표시/숨김을 전환한다', () => {
    refs.overlay = createDevtoolsOverlay();

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(true);

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(false);

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(true);
  });

  it('update()가 앱 목록을 렌더링한다', () => {
    refs.overlay = createDevtoolsOverlay();
    const apps = createSampleApps();

    refs.overlay.update(apps);

    const el = getOverlayElement();
    const rows = el?.querySelectorAll('tbody tr') ?? [];
    expect(rows.length).toBe(3);

    const firstRowCells = rows[0]?.querySelectorAll('td') ?? [];
    expect(firstRowCells[0]?.textContent).toBe('app-a');
    expect(firstRowCells[3]?.textContent).toBe('120ms');

    const secondRowCells = rows[1]?.querySelectorAll('td') ?? [];
    expect(secondRowCells[3]?.textContent).toBe('-');

    const thirdRowCells = rows[2]?.querySelectorAll('td') ?? [];
    expect(thirdRowCells[3]?.textContent).toBe('0ms');
  });

  it('상태별 배지 색상이 올바르다', () => {
    refs.overlay = createDevtoolsOverlay();
    const apps: readonly OverlayAppInfo[] = [
      { name: 'mounted-app', status: 'MOUNTED', container: '#a' },
      { name: 'error-app', status: 'LOAD_ERROR', container: '#b' },
      { name: 'loading-app', status: 'LOADING', container: '#c' },
      { name: 'not-loaded-app', status: 'NOT_LOADED', container: '#d' },
      { name: 'unknown-app', status: 'UNKNOWN_STATUS', container: '#e' },
    ];

    refs.overlay.update(apps);

    const el = getOverlayElement();
    const badges = el?.querySelectorAll('tbody td span:first-child') ?? [];

    const mountedBadge = badges[0];
    expect(mountedBadge?.getAttribute('data-color')).toBe('#4caf50');

    const errorBadge = badges[1];
    expect(errorBadge?.getAttribute('data-color')).toBe('#f44336');

    const loadingBadge = badges[2];
    expect(loadingBadge?.getAttribute('data-color')).toBe('#2196f3');

    const notLoadedBadge = badges[3];
    expect(notLoadedBadge?.getAttribute('data-color')).toBe('#9e9e9e');

    const unknownBadge = badges[4];
    expect(unknownBadge?.getAttribute('data-color')).toBe('#666');
  });

  it('destroy()가 오버레이를 DOM에서 제거한다', () => {
    refs.overlay = createDevtoolsOverlay();
    expect(getOverlayElement()).not.toBeNull();

    refs.overlay.destroy();
    refs.overlay = null;

    expect(getOverlayElement()).toBeNull();
  });

  it('키보드 단축키가 toggle을 트리거한다', () => {
    refs.overlay = createDevtoolsOverlay();
    expect(refs.overlay.visible).toBe(false);

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });
    expect(refs.overlay.visible).toBe(true);

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });
    expect(refs.overlay.visible).toBe(false);
  });

  it('커스텀 position이 적용된다', () => {
    refs.overlay = createDevtoolsOverlay({ position: 'top-left' });

    const el = getOverlayElement();
    expect(el?.style.top).toBe('16px');
    expect(el?.style.left).toBe('16px');
    expect(el?.style.bottom).toBe('');
    expect(el?.style.right).toBe('');
  });

  it('update()를 다시 호출하면 이전 행이 제거된다', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.update(createSampleApps());

    const el = getOverlayElement();
    expect(el?.querySelectorAll('tbody tr').length).toBe(3);

    refs.overlay.update([{ name: 'only-one', status: 'MOUNTED', container: '#x' }]);
    expect(el?.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('destroy() 이후 키보드 단축키가 동작하지 않는다', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.destroy();

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });

    expect(getOverlayElement()).toBeNull();
  });
});
