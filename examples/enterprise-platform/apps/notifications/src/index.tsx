/**
 * Notifications MFE — cross-MFE event collection and notification center demonstration.
 *
 * Demo points:
 * - Collects events from other MFEs via window CustomEvent subscription
 * - Aggregates notification list (max 20, newest first)
 * - Unread notification badge and toast animation
 * - Dispatches esmap:notification:click event on notification click
 */
import { createReactMfeApp } from '@esmap/react';
import { NotificationCenter } from './NotificationCenter.js';

export default createReactMfeApp({
  rootComponent: NotificationCenter,
});
