import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { TaskDetail } from './TaskDetail.js';

/** Kanban column identifier representing task status */
type TaskStatus = 'todo' | 'in-progress' | 'done';

/** Data structure for a task item */
interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly status: TaskStatus;
}

/** Display settings for a kanban column */
interface ColumnConfig {
  readonly key: TaskStatus;
  readonly label: string;
  readonly color: string;
  readonly headerBg: string;
}

/** Badge color mapping per priority */
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: '#f85149',
  medium: '#d29922',
  low: '#3fb950',
};

/** Kanban column configuration list */
const COLUMNS: readonly ColumnConfig[] = [
  { key: 'todo', label: 'To Do', color: '#8b949e', headerBg: '#1c2128' },
  { key: 'in-progress', label: 'In Progress', color: '#d29922', headerBg: '#1c2128' },
  { key: 'done', label: 'Done', color: '#3fb950', headerBg: '#1c2128' },
] as const;

/** Array defining the state transition order */
const STATUS_ORDER: readonly TaskStatus[] = ['todo', 'in-progress', 'done'] as const;

/** Demo task data */
const INITIAL_TASKS: readonly Task[] = [
  {
    id: 'task-1',
    title: 'Design SSO Auth Module',
    description: 'Write architecture design document for SAML/OIDC-based SSO authentication flow',
    assigneeId: 'user-1',
    assigneeName: 'Minhyeok Kim',
    priority: 'high',
    status: 'in-progress',
  },
  {
    id: 'task-2',
    title: 'Configure API Gateway Routing',
    description: 'Define and implement API gateway routing rules between microservices',
    assigneeId: 'user-2',
    assigneeName: 'Seoyeon Lee',
    priority: 'high',
    status: 'todo',
  },
  {
    id: 'task-3',
    title: 'Optimize Dashboard Widget Performance',
    description: 'Profile dashboard widget rendering performance and apply React.memo',
    assigneeId: 'user-3',
    assigneeName: 'Jihoon Park',
    priority: 'medium',
    status: 'in-progress',
  },
  {
    id: 'task-4',
    title: 'Implement Team Onboarding Checklist',
    description: 'Build onboarding workflow checklist UI for new team members',
    assigneeId: 'user-1',
    assigneeName: 'Minhyeok Kim',
    priority: 'medium',
    status: 'todo',
  },
  {
    id: 'task-5',
    title: 'Integrate Notification Service WebSocket',
    description:
      'Implement WebSocket connection and reconnection logic for real-time notifications',
    assigneeId: 'user-4',
    assigneeName: 'Subin Choi',
    priority: 'high',
    status: 'todo',
  },
  {
    id: 'task-6',
    title: 'Design User Permission Matrix',
    description: 'Define RBAC-based user permission matrix and design management UI',
    assigneeId: 'user-2',
    assigneeName: 'Seoyeon Lee',
    priority: 'medium',
    status: 'done',
  },
  {
    id: 'task-7',
    title: 'Set Up CI/CD Deployment Pipeline',
    description: 'Configure multi-stage deployment pipeline using GitHub Actions',
    assigneeId: 'user-5',
    assigneeName: 'Daeun Jeong',
    priority: 'low',
    status: 'done',
  },
  {
    id: 'task-8',
    title: 'Write E2E Test Scenarios',
    description: 'Write Playwright-based E2E test scenarios for key user flows',
    assigneeId: 'user-3',
    assigneeName: 'Jihoon Park',
    priority: 'low',
    status: 'todo',
  },
  {
    id: 'task-9',
    title: 'Clean Up i18n Keys',
    description: 'Remove duplicate and unused i18n keys, unify naming conventions',
    assigneeId: 'user-5',
    assigneeName: 'Daeun Jeong',
    priority: 'low',
    status: 'in-progress',
  },
  {
    id: 'task-10',
    title: 'Integrate Grafana Monitoring Dashboard',
    description: 'Configure Grafana dashboard templates based on Prometheus metrics',
    assigneeId: 'user-4',
    assigneeName: 'Subin Choi',
    priority: 'medium',
    status: 'todo',
  },
] as const;

/**
 * Dispatches an esmap:task:select custom event.
 * @param task - the selected task
 */
const dispatchTaskSelect = (task: Task): void => {
  window.dispatchEvent(
    new CustomEvent('esmap:task:select', {
      detail: { taskId: task.id, title: task.title, assigneeId: task.assigneeId },
    }),
  );
};

/**
 * Dispatches an esmap:task:status-change custom event.
 * @param taskId - task identifier
 * @param from - previous status
 * @param to - new status
 * @param assigneeId - assignee identifier
 */
const dispatchStatusChange = (
  taskId: string,
  from: TaskStatus,
  to: TaskStatus,
  assigneeId: string,
): void => {
  window.dispatchEvent(
    new CustomEvent('esmap:task:status-change', {
      detail: { taskId, from, to, assigneeId },
    }),
  );
};

/**
 * Transitions the task status to the next step.
 * @param currentStatus - current task status
 * @returns the next status (cycles back to todo from done)
 */
const getNextStatus = (currentStatus: TaskStatus): TaskStatus => {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIndex];
};

/**
 * Task Board main view.
 * Renders a kanban-style 3-column board and demonstrates inter-MFE event communication.
 */
export function TaskBoard(): ReactNode {
  const [tasks, setTasks] = useState<readonly Task[]>(INITIAL_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  const selectedTask = selectedTaskId ? (tasks.find((t) => t.id === selectedTaskId) ?? null) : null;

  /** Updates selection state and dispatches event on task click. */
  const handleTaskClick = useCallback((task: Task): void => {
    setSelectedTaskId(task.id);
    dispatchTaskSelect(task);
  }, []);

  /** Moves the task to the next status when the status chip is clicked. */
  const handleStatusChange = useCallback((task: Task): void => {
    const nextStatus = getNextStatus(task.status);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    dispatchStatusChange(task.id, task.status, nextStatus, task.assigneeId);
  }, []);

  /** Closes the detail panel. */
  const handleCloseDetail = useCallback((): void => {
    setSelectedTaskId(null);
  }, []);

  // Subscribe to team:member-select event — apply filter when a member is selected in team directory
  useEffect(() => {
    /** team:member-select event handler */
    const handleMemberSelect = (e: Event): void => {
      if (!(e instanceof CustomEvent)) return;
      const detail: { memberId: string } = e.detail;
      setFilterMemberId(detail.memberId);
    };

    window.addEventListener('esmap:team:member-select', handleMemberSelect);
    return () => {
      window.removeEventListener('esmap:team:member-select', handleMemberSelect);
    };
  }, []);

  // Subscribe to notification:click event — auto-select the task when notification is clicked
  useEffect(() => {
    /** notification:click event handler */
    const handleNotificationClick = (e: Event): void => {
      if (!(e instanceof CustomEvent)) return;
      const detail: { taskId: string } = e.detail;
      const task = tasks.find((t) => t.id === detail.taskId);
      if (task) {
        setSelectedTaskId(task.id);
        dispatchTaskSelect(task);
      }
    };

    window.addEventListener('esmap:notification:click', handleNotificationClick);
    return () => {
      window.removeEventListener('esmap:notification:click', handleNotificationClick);
    };
  }, [tasks]);

  // Subscribe to workspace.selectedMemberId global state changes
  useEffect(() => {
    /** workspace:state-change event handler */
    const handleGlobalState = (e: Event): void => {
      if (!(e instanceof CustomEvent)) return;
      const detail: { key: string; value: string | null } = e.detail;
      if (detail.key === 'workspace.selectedMemberId') {
        setFilterMemberId(detail.value);
      }
    };

    window.addEventListener('esmap:global-state:change', handleGlobalState);
    return () => {
      window.removeEventListener('esmap:global-state:change', handleGlobalState);
    };
  }, []);

  const filteredTasks = filterMemberId
    ? tasks.filter((t) => t.assigneeId === filterMemberId)
    : tasks;

  /** Returns the list of tasks for the specified status. */
  const getTasksByStatus = (status: TaskStatus): readonly Task[] =>
    filteredTasks.filter((t) => t.status === status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#e6edf3' }}>
            Task Board
          </h1>
          <p style={{ color: '#8b949e', margin: '4px 0 0 0', fontSize: '14px' }}>
            Kanban board — click status chips to move tasks, click cards for details
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {filterMemberId && (
            <Button variant="ghost" size="sm" onClick={() => setFilterMemberId(null)}>
              Clear Filter
            </Button>
          )}
          <span style={{ fontSize: '13px', color: '#8b949e' }}>{filteredTasks.length} tasks</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Kanban column area */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            flex: selectedTask ? '1 1 65%' : '1 1 100%',
            minWidth: 0,
          }}
        >
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.key}
              column={column}
              tasks={getTasksByStatus(column.key)}
              selectedTaskId={selectedTaskId}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

        {/* Task detail panel */}
        {selectedTask && (
          <div style={{ flex: '0 0 35%', minWidth: '320px' }}>
            <TaskDetail task={selectedTask} onClose={handleCloseDetail} />
          </div>
        )}
      </div>
    </div>
  );
}

/** KanbanColumn component props */
interface KanbanColumnProps {
  readonly column: ColumnConfig;
  readonly tasks: readonly Task[];
  readonly selectedTaskId: string | null;
  readonly onTaskClick: (task: Task) => void;
  readonly onStatusChange: (task: Task) => void;
}

/**
 * Renders a kanban column.
 * Displays the task count in the column header and lists the contained task cards.
 */
function KanbanColumn({
  column,
  tasks,
  selectedTaskId,
  onTaskClick,
  onStatusChange,
}: KanbanColumnProps): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '200px',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: column.headerBg,
          borderRadius: '8px 8px 0 0',
          borderBottom: `2px solid ${column.color}`,
        }}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: column.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: '600', fontSize: '14px', color: '#e6edf3' }}>
          {column.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: '#8b949e',
            background: '#21262d',
            padding: '2px 8px',
            borderRadius: '10px',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task card list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: '#484f58',
              fontSize: '13px',
              border: '1px dashed #21262d',
              borderRadius: '8px',
            }}
          >
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

/** TaskCard component props */
interface TaskCardProps {
  readonly task: Task;
  readonly isSelected: boolean;
  readonly onTaskClick: (task: Task) => void;
  readonly onStatusChange: (task: Task) => void;
}

/**
 * Renders an individual task card.
 * Click the card for detail view, click the status chip to move to the next status.
 */
function TaskCard({ task, isSelected, onTaskClick, onStatusChange }: TaskCardProps): ReactNode {
  const nextStatus = getNextStatus(task.status);
  const nextLabel = COLUMNS.find((c) => c.key === nextStatus)?.label ?? nextStatus;

  return (
    <Card padding="sm">
      <div
        onClick={() => onTaskClick(task)}
        style={{
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          outline: isSelected ? '2px solid #58a6ff' : 'none',
          outlineOffset: '4px',
        }}
      >
        {/* Priority badge + task ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: PRIORITY_COLORS[task.priority],
              background: `${PRIORITY_COLORS[task.priority]}1a`,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {task.priority}
          </span>
          <span style={{ fontSize: '11px', color: '#484f58' }}>{task.id}</span>
        </div>

        {/* Task title */}
        <div
          style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#e6edf3',
            marginBottom: '8px',
            lineHeight: '1.4',
          }}
        >
          {task.title}
        </div>

        {/* Assignee + status transition chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#21262d',
                border: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#8b949e',
                flexShrink: 0,
              }}
            >
              {task.assigneeName.charAt(0)}
            </span>
            <span style={{ fontSize: '12px', color: '#8b949e' }}>{task.assigneeName}</span>
          </div>

          {/* Status transition chip — click to move to next status */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task);
            }}
            style={{
              fontSize: '11px',
              color: '#8b949e',
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '12px',
              padding: '2px 8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title={`Move to "${nextLabel}"`}
          >
            → {nextLabel}
          </button>
        </div>
      </div>
    </Card>
  );
}
