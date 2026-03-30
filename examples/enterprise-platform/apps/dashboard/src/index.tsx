/**
 * Dashboard MFE — nested Parcel + shared design system demonstration.
 *
 * Demo points:
 * - Embeds activity-feed as a widget via EsmapParcel (nested MFE)
 * - Subscribes to auth state via useGlobalState
 * - Consumes @enterprise/design-system components via import map
 */
import { createReactMfeApp } from '@esmap/react';
import { Dashboard } from './Dashboard.js';

export default createReactMfeApp({
  rootComponent: Dashboard,
});
