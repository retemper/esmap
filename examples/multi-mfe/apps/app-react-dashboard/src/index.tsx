import { createReactMfeApp } from '@esmap/react';
import { Dashboard } from './Dashboard.js';
import { AppProvider } from './AppProvider.js';

/**
 * React 기반 대시보드 MFE.
 * createReactMfeApp으로 esmap 라이프사이클에 연결한다.
 */
export default createReactMfeApp({
  rootComponent: Dashboard,
  wrapWith: AppProvider,
});
