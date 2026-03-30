/**
 * Task Board MFE — kanban board + event-based inter-MFE communication demonstration.
 *
 * Demo points:
 * - Loose-coupled MFE communication via CustomEvent (task:select, task:status-change)
 * - External event subscription (team:member-select, notification:click)
 * - Embeds activity-feed in the task detail panel via EsmapParcel
 * - Consumes @enterprise/design-system components via import map
 */
import { createReactMfeApp } from '@esmap/react';
import { TaskBoard } from './TaskBoard.js';

export default createReactMfeApp({
  rootComponent: TaskBoard,
});
