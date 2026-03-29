/** 네비게이션 MFE — 모든 페이지에서 항상 활성화되는 GNB */

export function bootstrap(): Promise<void> {
  console.log('[app-nav] bootstrap');
  return Promise.resolve();
}

export function mount(container: HTMLElement): Promise<void> {
  console.log('[app-nav] mount');
  container.innerHTML = `
    <nav style="background:#1a1a2e;color:#fff;padding:12px 24px;display:flex;gap:16px;align-items:center;">
      <strong style="margin-right:auto;">Esmap MFE Demo</strong>
      <a href="/" style="color:#e0e0e0;text-decoration:none;" data-link>Home</a>
      <a href="/settings" style="color:#e0e0e0;text-decoration:none;" data-link>Settings</a>
      <a href="/react" style="color:#61dafb;text-decoration:none;" data-link>React</a>
    </nav>
  `;

  // SPA 네비게이션: <a data-link> 클릭 시 pushState 사용
  container.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLAnchorElement && target.hasAttribute('data-link')) {
      e.preventDefault();
      history.pushState(null, '', target.href);
    }
  });

  return Promise.resolve();
}

export function unmount(container: HTMLElement): Promise<void> {
  console.log('[app-nav] unmount');
  container.innerHTML = '';
  return Promise.resolve();
}
