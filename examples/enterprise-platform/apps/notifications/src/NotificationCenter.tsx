import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

/** Notification item source type */
type NotificationType = 'task' | 'member' | 'activity';

/** Single notification item */
interface NotificationItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly message: string;
  readonly time: string;
  readonly read: boolean;
  /** Target ID to propagate on click */
  readonly targetId: string;
  /** Whether slide-in animation is active */
  readonly isNew: boolean;
}

/** Detail type for notification click events */
interface NotificationClickDetail {
  readonly type: 'task' | 'member';
  readonly targetId: string;
}

/** Maximum number of notifications to retain */
const MAX_NOTIFICATIONS = 20;

/** Icon character per type */
const TYPE_ICONS: Record<NotificationType, string> = {
  task: '\u2714',
  member: '\u263A',
  activity: '\u2605',
} as const;

/** Label per type */
const TYPE_LABELS: Record<NotificationType, string> = {
  task: 'Task',
  member: 'Team',
  activity: 'Activity',
} as const;

/** Seed notification data (for initial demo) */
const SEED_NOTIFICATIONS: readonly NotificationItem[] = [
  {
    id: 'seed-1',
    type: 'task',
    message: 'Status of "API Design Review" changed to In Progress',
    time: '5m ago',
    read: false,
    targetId: 'task-101',
    isNew: false,
  },
  {
    id: 'seed-2',
    type: 'member',
    message: 'Seoyeon Lee has been assigned to the Backend team',
    time: '12m ago',
    read: false,
    targetId: 'member-202',
    isNew: false,
  },
  {
    id: 'seed-3',
    type: 'activity',
    message: 'Jihoon Park commented on "Weekly Retrospective" document',
    time: '30m ago',
    read: true,
    targetId: 'activity-303',
    isNew: false,
  },
] as const;

/** Counter reference for unique ID generation */
const createIdGenerator = (): (() => string) => {
  const counter = { value: 0 };
  return () => {
    counter.value += 1;
    return `notif-${Date.now()}-${counter.value}`;
  };
};

/**
 * Extracts a notification message from a CustomEvent.
 * @param eventName - the received event name
 * @param detail - the event detail object
 * @returns the message string to display in the notification
 */
function buildMessage(eventName: string, detail: Record<string, unknown>): string {
  switch (eventName) {
    case 'esmap:task:status-change':
      return `Task "${String(detail['taskName'] ?? detail['taskId'] ?? 'unknown')}" status changed to ${String(detail['status'] ?? 'unknown')}`;
    case 'esmap:team:member-select':
      return `${String(detail['memberName'] ?? detail['memberId'] ?? 'unknown')} has been selected`;
    case 'esmap:activity:new':
      return `New activity: ${String(detail['message'] ?? 'unknown')}`;
    default:
      return `Unknown event: ${eventName}`;
  }
}

/**
 * Maps an event name to a notification type.
 * @param eventName - the received event name
 * @returns the corresponding NotificationType
 */
function resolveType(eventName: string): NotificationType {
  switch (eventName) {
    case 'esmap:task:status-change':
      return 'task';
    case 'esmap:team:member-select':
      return 'member';
    case 'esmap:activity:new':
      return 'activity';
    default:
      return 'activity';
  }
}

/**
 * Extracts the targetId from an event detail.
 * @param eventType - the notification type
 * @param detail - the event detail object
 * @returns the target identifier string
 */
function resolveTargetId(eventType: NotificationType, detail: Record<string, unknown>): string {
  switch (eventType) {
    case 'task':
      return String(detail['taskId'] ?? `task-${Date.now()}`);
    case 'member':
      return String(detail['memberId'] ?? `member-${Date.now()}`);
    case 'activity':
      return String(detail['activityId'] ?? `activity-${Date.now()}`);
  }
}

/**
 * Notification Center widget.
 * Subscribes to CustomEvents from other MFEs and aggregates them into a notification list,
 * providing an unread count badge and toast animations.
 */
export function NotificationCenter(): ReactNode {
  const [notifications, setNotifications] = useState<readonly NotificationItem[]>(SEED_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const generateId = useRef(createIdGenerator()).current;

  /** Unread notification count */
  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * Converts a received CustomEvent into a notification item and adds it to the list.
   * Removes the oldest items when the maximum count is exceeded.
   */
  const handleEvent = useCallback(
    (eventName: string) => (event: Event) => {
      const detail = (event instanceof CustomEvent ? event.detail : {}) ?? {};
      const type = resolveType(eventName);
      const newNotification: NotificationItem = {
        id: generateId(),
        type,
        message: buildMessage(eventName, detail),
        time: 'Just now',
        read: false,
        targetId: resolveTargetId(type, detail),
        isNew: true,
      };

      setNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));

      // Remove slide-in animation flag after 3 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === newNotification.id ? { ...n, isNew: false } : n)),
        );
      }, 3000);
    },
    [generateId],
  );

  /** Register and unregister CustomEvent listeners */
  useEffect(() => {
    const eventNames = [
      'esmap:task:status-change',
      'esmap:team:member-select',
      'esmap:activity:new',
    ] as const;

    const handlers = eventNames.map((name) => ({
      name,
      handler: handleEvent(name),
    }));

    handlers.forEach(({ name, handler }) => {
      window.addEventListener(name, handler);
    });

    return () => {
      handlers.forEach(({ name, handler }) => {
        window.removeEventListener(name, handler);
      });
    };
  }, [handleEvent]);

  /**
   * Marks a notification as read on click and dispatches an esmap:notification:click event.
   * @param notification - the clicked notification item
   */
  const handleNotificationClick = useCallback((notification: NotificationItem): void => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );

    // Dispatch click event (activity type is mapped to task)
    const clickDetail: NotificationClickDetail = {
      type: notification.type === 'activity' ? 'task' : notification.type,
      targetId: notification.targetId,
    };

    window.dispatchEvent(
      new CustomEvent('esmap:notification:click', { detail: clickDetail }),
    );
  }, []);

  /** Marks all notifications as read. */
  const handleMarkAllRead = useCallback((): void => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /** Toggles the dropdown open/closed. */
  const handleToggle = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div style={{ position: 'relative', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Toggle button + badge */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          position: 'relative',
          background: '#161b22',
          border: '1px solid #21262d',
          borderRadius: '8px',
          padding: '8px 14px',
          color: '#e6edf3',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '16px' }}>{'\uD83D\uDD14'}</span>
        Notifications
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#f87171',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '380px',
            maxHeight: '480px',
            overflowY: 'auto',
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '12px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid #21262d',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#e6edf3' }}>
              Notifications ({notifications.length})
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#58a6ff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#484f58',
                fontSize: '13px',
              }}
            >
              No notifications
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 16px',
                    background: notification.read ? 'transparent' : 'rgba(56, 139, 253, 0.06)',
                    border: 'none',
                    borderBottom: '1px solid #21262d',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                    animation: notification.isNew ? 'slideInFromTop 0.3s ease-out' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#161b22';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.read
                      ? 'transparent'
                      : 'rgba(56, 139, 253, 0.06)';
                  }}
                >
                  {/* Unread notification dot */}
                  {!notification.read && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#58a6ff',
                        flexShrink: 0,
                        marginTop: '5px',
                      }}
                    />
                  )}

                  {/* Type icon */}
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#161b22',
                      border: '1px solid #21262d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[notification.type]}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#e6edf3',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#8b949e',
                          background: '#161b22',
                          border: '1px solid #21262d',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          marginRight: '6px',
                        }}
                      >
                        {TYPE_LABELS[notification.type]}
                      </span>
                      {notification.message}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#484f58',
                        marginTop: '4px',
                      }}
                    >
                      {notification.time}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSS keyframes for toast animation */}
      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
