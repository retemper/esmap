import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

/** 알림 항목의 출처 타입 */
type NotificationType = 'task' | 'member' | 'activity';

/** 단일 알림 항목 */
interface NotificationItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly message: string;
  readonly time: string;
  readonly read: boolean;
  /** 클릭 시 전파할 대상 ID */
  readonly targetId: string;
  /** 슬라이드-인 애니메이션 활성 여부 */
  readonly isNew: boolean;
}

/** 알림 클릭 이벤트의 detail 타입 */
interface NotificationClickDetail {
  readonly type: 'task' | 'member';
  readonly targetId: string;
}

/** 최대 알림 보관 개수 */
const MAX_NOTIFICATIONS = 20;

/** 타입별 아이콘 문자 */
const TYPE_ICONS: Record<NotificationType, string> = {
  task: '\u2714',
  member: '\u263A',
  activity: '\u2605',
} as const;

/** 타입별 라벨 */
const TYPE_LABELS: Record<NotificationType, string> = {
  task: 'Task',
  member: 'Team',
  activity: 'Activity',
} as const;

/** 시드 알림 데이터 (초기 데모용) */
const SEED_NOTIFICATIONS: readonly NotificationItem[] = [
  {
    id: 'seed-1',
    type: 'task',
    message: '"API 설계 검토" 상태가 In Progress로 변경되었습니다',
    time: '5분 전',
    read: false,
    targetId: 'task-101',
    isNew: false,
  },
  {
    id: 'seed-2',
    type: 'member',
    message: '이서연님이 Backend 팀에 배정되었습니다',
    time: '12분 전',
    read: false,
    targetId: 'member-202',
    isNew: false,
  },
  {
    id: 'seed-3',
    type: 'activity',
    message: '박지훈님이 "주간 회고" 문서에 댓글을 남겼습니다',
    time: '30분 전',
    read: true,
    targetId: 'activity-303',
    isNew: false,
  },
] as const;

/** 고유 ID 생성용 카운터 참조값 */
const createIdGenerator = (): (() => string) => {
  const counter = { value: 0 };
  return () => {
    counter.value += 1;
    return `notif-${Date.now()}-${counter.value}`;
  };
};

/**
 * CustomEvent에서 알림 메시지를 추출한다.
 * @param eventName - 수신된 이벤트 이름
 * @param detail - 이벤트 detail 객체
 * @returns 알림에 표시할 메시지 문자열
 */
function buildMessage(eventName: string, detail: Record<string, unknown>): string {
  switch (eventName) {
    case 'esmap:task:status-change':
      return `태스크 "${String(detail['taskName'] ?? detail['taskId'] ?? 'unknown')}" 상태가 ${String(detail['status'] ?? 'unknown')}(으)로 변경되었습니다`;
    case 'esmap:team:member-select':
      return `${String(detail['memberName'] ?? detail['memberId'] ?? 'unknown')}님이 선택되었습니다`;
    case 'esmap:activity:new':
      return `새로운 활동: ${String(detail['message'] ?? 'unknown')}`;
    default:
      return `알 수 없는 이벤트: ${eventName}`;
  }
}

/**
 * 이벤트 이름을 알림 타입으로 매핑한다.
 * @param eventName - 수신된 이벤트 이름
 * @returns 대응하는 NotificationType
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
 * 이벤트 detail에서 targetId를 추출한다.
 * @param eventType - 알림 타입
 * @param detail - 이벤트 detail 객체
 * @returns 대상 식별자 문자열
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
 * Notification Center 위젯.
 * 다른 MFE에서 발생하는 CustomEvent를 구독하여 알림 목록으로 집계하고,
 * 읽지 않은 알림 수 배지와 토스트 애니메이션을 제공한다.
 */
export function NotificationCenter(): ReactNode {
  const [notifications, setNotifications] = useState<readonly NotificationItem[]>(SEED_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const generateId = useRef(createIdGenerator()).current;

  /** 읽지 않은 알림 개수 */
  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * 수신된 CustomEvent를 알림 항목으로 변환하여 목록에 추가한다.
   * 최대 개수를 초과하면 오래된 항목부터 제거한다.
   */
  const handleEvent = useCallback(
    (eventName: string) => (event: Event) => {
      const detail = (event instanceof CustomEvent ? event.detail : {}) ?? {};
      const type = resolveType(eventName);
      const newNotification: NotificationItem = {
        id: generateId(),
        type,
        message: buildMessage(eventName, detail),
        time: '방금',
        read: false,
        targetId: resolveTargetId(type, detail),
        isNew: true,
      };

      setNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));

      // 3초 후 슬라이드-인 애니메이션 플래그 제거
      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === newNotification.id ? { ...n, isNew: false } : n)),
        );
      }, 3000);
    },
    [generateId],
  );

  /** CustomEvent 리스너 등록 및 해제 */
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
   * 알림 클릭 시 읽음 처리하고, esmap:notification:click 이벤트를 발행한다.
   * @param notification - 클릭된 알림 항목
   */
  const handleNotificationClick = useCallback((notification: NotificationItem): void => {
    // 읽음 처리
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );

    // 클릭 이벤트 발행 (activity 타입은 task로 매핑)
    const clickDetail: NotificationClickDetail = {
      type: notification.type === 'activity' ? 'task' : notification.type,
      targetId: notification.targetId,
    };

    window.dispatchEvent(
      new CustomEvent('esmap:notification:click', { detail: clickDetail }),
    );
  }, []);

  /** 모든 알림을 읽음 처리한다. */
  const handleMarkAllRead = useCallback((): void => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /** 드롭다운 열기/닫기를 토글한다. */
  const handleToggle = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div style={{ position: 'relative', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 토글 버튼 + 배지 */}
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

      {/* 드롭다운 패널 */}
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
          {/* 헤더 */}
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
              알림 ({notifications.length})
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
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#484f58',
                fontSize: '13px',
              }}
            >
              알림이 없습니다
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
                  {/* 읽지 않은 알림 도트 */}
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

                  {/* 타입 아이콘 */}
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

                  {/* 내용 */}
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

      {/* 토스트 애니메이션용 CSS keyframes */}
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
