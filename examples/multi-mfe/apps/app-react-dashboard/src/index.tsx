import { createReactMfeApp } from '@esmap/react';
import { Dashboard } from './Dashboard.js';
import { AppProvider } from './AppProvider.js';

/**
 * React-based dashboard MFE.
 * Connects to the esmap lifecycle via createReactMfeApp.
 */
export default createReactMfeApp({
  rootComponent: Dashboard,
  wrapWith: AppProvider,
});
