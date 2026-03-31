/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDevtoolsOverlay } from './overlay.js';
import type { DevtoolsOverlay, OverlayAppInfo } from './overlay.js';

/** Manages the overlay instance for testing. */
const refs: { overlay: DevtoolsOverlay | null } = { overlay: null };

/** Queries the overlay root element by the data-esmap-devtools attribute. */
function getOverlayElement(): HTMLElement | null {
  return document.querySelector('[data-esmap-devtools="overlay"]');
}

/** Creates a sample app info list for testing. */
function createSampleApps(): readonly OverlayAppInfo[] {
  return [
    { name: 'app-a', status: 'MOUNTED', container: '#root-a', perfDuration: 120 },
    { name: 'app-b', status: 'LOAD_ERROR', container: '#root-b' },
    { name: 'app-c', status: 'NOT_LOADED', container: '#root-c', perfDuration: 0 },
  ];
}

/** Creates and dispatches a KeyboardEvent. */
function dispatchKeydown(options: KeyboardEventInit): void {
  const event = new KeyboardEvent('keydown', options);
  document.dispatchEvent(event);
}

describe('createDevtoolsOverlay', () => {
  beforeEach(() => {
    refs.overlay?.destroy();
    refs.overlay = null;
  });

  it('appends the overlay to document.body', () => {
    refs.overlay = createDevtoolsOverlay();

    const el = getOverlayElement();
    expect(el).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);
  });

  it('is hidden in the initial state', () => {
    refs.overlay = createDevtoolsOverlay();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('none');
    expect(refs.overlay.visible).toBe(false);
  });

  it('show() displays the overlay', () => {
    refs.overlay = createDevtoolsOverlay();

    refs.overlay.show();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('block');
    expect(refs.overlay.visible).toBe(true);
  });

  it('hide() hides the overlay', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.show();

    refs.overlay.hide();

    const el = getOverlayElement();
    expect(el?.style.display).toBe('none');
    expect(refs.overlay.visible).toBe(false);
  });

  it('toggle() switches between show and hide', () => {
    refs.overlay = createDevtoolsOverlay();

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(true);

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(false);

    refs.overlay.toggle();
    expect(refs.overlay.visible).toBe(true);
  });

  it('update() renders the app list', () => {
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

  it('badge colors are correct per status', () => {
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

  it('destroy() removes the overlay from the DOM', () => {
    refs.overlay = createDevtoolsOverlay();
    expect(getOverlayElement()).not.toBeNull();

    refs.overlay.destroy();
    refs.overlay = null;

    expect(getOverlayElement()).toBeNull();
  });

  it('keyboard shortcut triggers toggle', () => {
    refs.overlay = createDevtoolsOverlay();
    expect(refs.overlay.visible).toBe(false);

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });
    expect(refs.overlay.visible).toBe(true);

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });
    expect(refs.overlay.visible).toBe(false);
  });

  it('applies custom position', () => {
    refs.overlay = createDevtoolsOverlay({ position: 'top-left' });

    const el = getOverlayElement();
    expect(el?.style.top).toBe('16px');
    expect(el?.style.left).toBe('16px');
    expect(el?.style.bottom).toBe('');
    expect(el?.style.right).toBe('');
  });

  it('calling update() again removes previous rows', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.update(createSampleApps());

    const el = getOverlayElement();
    expect(el?.querySelectorAll('tbody tr').length).toBe(3);

    refs.overlay.update([{ name: 'only-one', status: 'MOUNTED', container: '#x' }]);
    expect(el?.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('keyboard shortcut does not work after destroy()', () => {
    refs.overlay = createDevtoolsOverlay();
    refs.overlay.destroy();

    dispatchKeydown({ key: 'D', altKey: true, shiftKey: true });

    expect(getOverlayElement()).toBeNull();
  });
});
