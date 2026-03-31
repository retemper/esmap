/**
 * Team Directory MFE — keepAlive state preservation + lazy sub-module demonstration.
 *
 * Demo points:
 * - keepAlive: preserves search term, scroll position, and selection state when navigating away and back
 * - Lazy sub-module: loads MemberDetail via dynamic import (code splitting within MFE)
 * - Design system component consumption
 * - Dual-mode rendering: page (default) / sidebar (compact) mode support
 * - Member selection events: esmap:team:member-select / esmap:team:member-deselect
 */
import { createReactMfeApp } from '@esmap/react';
import { TeamList, type TeamListProps } from './TeamList.js';

export default createReactMfeApp<TeamListProps>({
  rootComponent: TeamList,
});
