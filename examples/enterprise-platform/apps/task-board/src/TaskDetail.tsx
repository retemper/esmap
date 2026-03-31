import type { ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { EsmapParcel } from '@esmap/react';
import type { MfeApp } from '@esmap/shared';

/** Task priority */
type Priority = 'high' | 'medium' | 'low';

/** Task data structure passed to the TaskDetail component */
interface TaskDetailTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly priority: Priority;
  readonly status: string;
}

/** TaskDetail component props */
interface TaskDetailProps {
  /** Task data to display */
  readonly task: TaskDetailTask;
  /** Callback for closing the detail panel */
  readonly onClose: () => void;
}

/** Label mapping per priority */
const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Color mapping per priority */
const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#f85149',
  medium: '#d29922',
  low: '#3fb950',
};

/** Label mapping per status */
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};

/**
 * Asynchronously loads the Activity Feed MFE and returns its MfeApp.
 * Extracts the default export to match the type expected by EsmapParcel.
 */
async function loadActivityFeed(): Promise<MfeApp> {
  const mod = await import(/* @vite-ignore */ '@enterprise/activity-feed');
  return mod.default;
}

/**
 * Displays task detail information in a drawer format.
 * Embeds the activity-feed MFE as a Parcel at the bottom to show task-related activity history.
 */
export function TaskDetail({ task, onClose }: TaskDetailProps): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '8px',
        padding: '20px',
        height: 'fit-content',
      }}
    >
      {/* Header — title + close button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <span
            style={{ fontSize: '12px', color: '#484f58', marginBottom: '4px', display: 'block' }}
          >
            {task.id}
          </span>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '700',
              margin: 0,
              color: '#e6edf3',
              lineHeight: '1.4',
            }}
          >
            {task.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* Meta information */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          padding: '12px',
          background: '#0d1117',
          borderRadius: '6px',
          border: '1px solid #21262d',
        }}
      >
        {/* Status */}
        <div>
          <div
            style={{
              fontSize: '11px',
              color: '#484f58',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            Status
          </div>
          <div style={{ fontSize: '13px', color: '#e6edf3' }}>
            {STATUS_LABELS[task.status] ?? task.status}
          </div>
        </div>

        {/* Priority */}
        <div>
          <div
            style={{
              fontSize: '11px',
              color: '#484f58',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            Priority
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: PRIORITY_COLORS[task.priority],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '13px', color: '#e6edf3' }}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
        </div>

        {/* Assignee */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div
            style={{
              fontSize: '11px',
              color: '#484f58',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            Assignee
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#21262d',
                border: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#8b949e',
                flexShrink: 0,
              }}
            >
              {task.assigneeName.charAt(0)}
            </span>
            <span style={{ fontSize: '13px', color: '#e6edf3' }}>{task.assigneeName}</span>
            <span style={{ fontSize: '11px', color: '#484f58' }}>({task.assigneeId})</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <div
          style={{
            fontSize: '11px',
            color: '#484f58',
            marginBottom: '8px',
            textTransform: 'uppercase',
            fontWeight: '600',
          }}
        >
          Description
        </div>
        <p style={{ fontSize: '14px', color: '#c9d1d9', margin: 0, lineHeight: '1.6' }}>
          {task.description}
        </p>
      </div>

      {/* Embedded Activity Feed — Parcel widget */}
      <Card title={`${task.id} Activity`} padding="sm">
        <EsmapParcel
          app={loadActivityFeed}
          appProps={{ mode: 'widget', maxItems: 3 }}
          loading={
            <div style={{ padding: '12px', color: '#8b949e', fontSize: '13px' }}>
              Loading Activity Feed...
            </div>
          }
          errorFallback={(error) => (
            <div style={{ padding: '12px', color: '#f85149', fontSize: '13px' }}>
              Failed to load Activity Feed: {error.message}
            </div>
          )}
          className="task-activity-widget"
        />
      </Card>
    </div>
  );
}
