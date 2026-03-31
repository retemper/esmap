import { useState, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';

/** Activity item */
interface ActivityItem {
  readonly id: string;
  readonly type: 'create' | 'update' | 'delete' | 'comment';
  readonly user: string;
  readonly message: string;
  readonly time: string;
}

/** Demo activity data */
const DEMO_ACTIVITIES: readonly ActivityItem[] = [
  {
    id: '1',
    type: 'create',
    user: 'Minhyeok Kim',
    message: 'Created new project "Q1 OKR"',
    time: '2m ago',
  },
  {
    id: '2',
    type: 'update',
    user: 'Seoyeon Lee',
    message: 'Updated the team list',
    time: '15m ago',
  },
  {
    id: '3',
    type: 'comment',
    user: 'Jihoon Park',
    message: 'Commented on "Weekly Retrospective" document',
    time: '1h ago',
  },
  {
    id: '4',
    type: 'delete',
    user: 'Subin Choi',
    message: 'Deleted expired invitation links',
    time: '2h ago',
  },
  {
    id: '5',
    type: 'create',
    user: 'Daeun Jeong',
    message: 'Added new team member "Sori Han"',
    time: '3h ago',
  },
  {
    id: '6',
    type: 'update',
    user: 'Minhyeok Kim',
    message: 'Reordered dashboard widgets',
    time: '4h ago',
  },
  {
    id: '7',
    type: 'comment',
    user: 'Seoyeon Lee',
    message: 'Left feedback on "Tech Stack Selection" document',
    time: '5h ago',
  },
  {
    id: '8',
    type: 'create',
    user: 'Jihoon Park',
    message: 'Created new channel "#architecture"',
    time: 'Yesterday',
  },
];

/** Icon per activity type */
const typeIcons: Record<string, string> = {
  create: '+',
  update: '~',
  delete: '-',
  comment: '#',
};

/** Color per activity type */
const typeColors: Record<string, string> = {
  create: '#16a34a',
  update: '#2563eb',
  delete: '#dc2626',
  comment: '#7c3aed',
};

/** Feed component props */
interface FeedProps {
  /** Display mode: 'page' (full page) or 'widget' (Parcel embed) */
  readonly mode?: 'page' | 'widget';
  /** Maximum number of items to display (for limiting in widget mode) */
  readonly maxItems?: number;
}

/**
 * Activity Feed view.
 * Renders as either a full page layout or a compact widget depending on props.mode.
 */
export function Feed(props: FeedProps): ReactNode {
  const mode = props.mode ?? 'page';
  const maxItems = props.maxItems ?? DEMO_ACTIVITIES.length;
  const [filter, setFilter] = useState<string>('all');

  const filtered = DEMO_ACTIVITIES.filter((item) => filter === 'all' || item.type === filter).slice(
    0,
    maxItems,
  );

  // ─── Widget mode: compact rendering ───
  if (mode === 'widget') {
    return (
      <div style={{ fontSize: '13px' }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: typeColors[item.type],
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '700',
                flexShrink: 0,
              }}
            >
              {typeIcons[item.type]}
            </span>
            <span style={{ flex: 1, color: '#334155' }}>
              <strong>{item.user}</strong> {item.message}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>{item.time}</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Page mode: full page layout ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Activity Feed</h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        Dual-mode MFE — this view works as both a standalone route (/activity) and a Dashboard
        Parcel widget
      </p>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['all', 'create', 'update', 'delete', 'comment'].map((type) => (
          <Button
            key={type}
            variant={filter === type ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {type === 'all' ? 'All' : type}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((item) => (
          <Card key={item.id} padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: typeColors[item.type],
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}
              >
                {typeIcons[item.type]}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500' }}>
                  <strong>{item.user}</strong> {item.message}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {item.time}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
