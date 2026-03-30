import type { ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { RecentActivity } from './widgets/RecentActivity.js';

/**
 * Dashboard main view.
 * Uses design system components via import map and
 * embeds the activity-feed MFE as a Parcel.
 */
export function Dashboard(): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Dashboard</h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        Nested Parcel + shared design system + global state demo
      </p>

      {/* Stat cards — using @enterprise/design-system Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <Card title="Total Users">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#2563eb' }}>1,284</div>
          <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '4px' }}>+12.5%</div>
        </Card>
        <Card title="Active Teams">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#7c3aed' }}>42</div>
          <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '4px' }}>+3</div>
        </Card>
        <Card title="This Week's Activity">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#d97706' }}>567</div>
          <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>-8.2%</div>
        </Card>
      </div>

      {/* Action buttons — using @enterprise/design-system Button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" size="sm">
          Add New User
        </Button>
        <Button variant="secondary" size="sm">
          Export Report
        </Button>
        <Button variant="ghost" size="sm">
          Settings
        </Button>
      </div>

      {/* Nested Parcel: embed activity-feed MFE as a widget */}
      <Card title="Recent Activity (Parcel Widget)" padding="sm">
        <RecentActivity />
      </Card>
    </div>
  );
}
