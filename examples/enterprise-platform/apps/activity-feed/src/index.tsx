/**
 * Activity Feed MFE — dual mode (route + Parcel) demonstration.
 *
 * Demo points:
 * - The same React component works as both a route MFE and a Parcel widget
 * - props.mode determines display mode: 'page' (full page) vs 'widget' (embedded)
 * - Receives Parcel props via createReactMfeApp's update lifecycle
 */
import { createReactMfeApp } from '@esmap/react';
import { Feed } from './Feed.js';

export default createReactMfeApp({
  rootComponent: Feed,
});
