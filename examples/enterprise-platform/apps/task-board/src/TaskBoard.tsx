import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { TaskDetail } from './TaskDetail.js';

/** 태스크 상태를 나타내는 칸반 컬럼 식별자 */
type TaskStatus = 'todo' | 'in-progress' | 'done';

/** 태스크 항목의 데이터 구조 */
interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly status: TaskStatus;
}

/** 칸반 컬럼의 표시 설정 */
interface ColumnConfig {
  readonly key: TaskStatus;
  readonly label: string;
  readonly color: string;
  readonly headerBg: string;
}

/** 우선순위별 뱃지 색상 매핑 */
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: '#f85149',
  medium: '#d29922',
  low: '#3fb950',
};

/** 칸반 컬럼 설정 목록 */
const COLUMNS: readonly ColumnConfig[] = [
  { key: 'todo', label: 'To Do', color: '#8b949e', headerBg: '#1c2128' },
  { key: 'in-progress', label: 'In Progress', color: '#d29922', headerBg: '#1c2128' },
  { key: 'done', label: 'Done', color: '#3fb950', headerBg: '#1c2128' },
] as const;

/** 상태 전환 순서를 정의하는 배열 */
const STATUS_ORDER: readonly TaskStatus[] = ['todo', 'in-progress', 'done'] as const;

/** 데모 태스크 데이터 */
const INITIAL_TASKS: readonly Task[] = [
  { id: 'task-1', title: 'SSO 인증 모듈 설계', description: 'SAML/OIDC 기반 SSO 인증 플로우 아키텍처 설계 문서 작성', assigneeId: 'user-1', assigneeName: '김민혁', priority: 'high', status: 'in-progress' },
  { id: 'task-2', title: 'API 게이트웨이 라우팅 설정', description: '마이크로서비스 간 API 게이트웨이 라우팅 규칙 정의 및 구현', assigneeId: 'user-2', assigneeName: '이서연', priority: 'high', status: 'todo' },
  { id: 'task-3', title: '대시보드 위젯 성능 최적화', description: '대시보드 위젯 렌더링 성능 프로파일링 및 React.memo 적용', assigneeId: 'user-3', assigneeName: '박지훈', priority: 'medium', status: 'in-progress' },
  { id: 'task-4', title: '팀원 온보딩 체크리스트 구현', description: '신규 팀원 온보딩 워크플로우 체크리스트 UI 구현', assigneeId: 'user-1', assigneeName: '김민혁', priority: 'medium', status: 'todo' },
  { id: 'task-5', title: '알림 서비스 WebSocket 연동', description: '실시간 알림을 위한 WebSocket 연결 및 재연결 로직 구현', assigneeId: 'user-4', assigneeName: '최수빈', priority: 'high', status: 'todo' },
  { id: 'task-6', title: '사용자 권한 매트릭스 설계', description: 'RBAC 기반 사용자 권한 매트릭스 정의 및 관리 UI 설계', assigneeId: 'user-2', assigneeName: '이서연', priority: 'medium', status: 'done' },
  { id: 'task-7', title: '배포 파이프라인 CI/CD 구성', description: 'GitHub Actions 기반 멀티 스테이지 배포 파이프라인 구성', assigneeId: 'user-5', assigneeName: '정다은', priority: 'low', status: 'done' },
  { id: 'task-8', title: 'E2E 테스트 시나리오 작성', description: 'Playwright 기반 주요 사용자 플로우 E2E 테스트 시나리오 작성', assigneeId: 'user-3', assigneeName: '박지훈', priority: 'low', status: 'todo' },
  { id: 'task-9', title: '국제화(i18n) 키 정리', description: '중복 및 미사용 i18n 키 정리, 네이밍 컨벤션 통일', assigneeId: 'user-5', assigneeName: '정다은', priority: 'low', status: 'in-progress' },
  { id: 'task-10', title: '모니터링 대시보드 Grafana 연동', description: 'Prometheus 메트릭 기반 Grafana 대시보드 템플릿 구성', assigneeId: 'user-4', assigneeName: '최수빈', priority: 'medium', status: 'todo' },
] as const;

/**
 * esmap:task:select 커스텀 이벤트를 디스패치한다.
 * @param task - 선택된 태스크
 */
const dispatchTaskSelect = (task: Task): void => {
  window.dispatchEvent(
    new CustomEvent('esmap:task:select', {
      detail: { taskId: task.id, title: task.title, assigneeId: task.assigneeId },
    }),
  );
};

/**
 * esmap:task:status-change 커스텀 이벤트를 디스패치한다.
 * @param taskId - 태스크 식별자
 * @param from - 이전 상태
 * @param to - 변경된 상태
 * @param assigneeId - 담당자 식별자
 */
const dispatchStatusChange = (taskId: string, from: TaskStatus, to: TaskStatus, assigneeId: string): void => {
  window.dispatchEvent(
    new CustomEvent('esmap:task:status-change', {
      detail: { taskId, from, to, assigneeId },
    }),
  );
};

/**
 * 태스크의 상태를 다음 단계로 전환한다.
 * @param currentStatus - 현재 태스크 상태
 * @returns 다음 상태 (done이면 todo로 순환)
 */
const getNextStatus = (currentStatus: TaskStatus): TaskStatus => {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIndex];
};

/**
 * Task Board 메인 뷰.
 * 칸반 형태의 3-컬럼 보드를 렌더링하고, MFE 간 이벤트 통신을 시연한다.
 */
export function TaskBoard(): ReactNode {
  const [tasks, setTasks] = useState<readonly Task[]>(INITIAL_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  /** 태스크 클릭 시 선택 상태를 업데이트하고 이벤트를 디스패치한다. */
  const handleTaskClick = useCallback((task: Task): void => {
    setSelectedTaskId(task.id);
    dispatchTaskSelect(task);
  }, []);

  /** 상태 칩 클릭 시 태스크를 다음 상태로 이동시킨다. */
  const handleStatusChange = useCallback((task: Task): void => {
    const nextStatus = getNextStatus(task.status);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: nextStatus } : t,
      ),
    );
    dispatchStatusChange(task.id, task.status, nextStatus, task.assigneeId);
  }, []);

  /** 상세 패널을 닫는다. */
  const handleCloseDetail = useCallback((): void => {
    setSelectedTaskId(null);
  }, []);

  // team:member-select 이벤트 구독 — 팀 디렉토리에서 멤버 선택 시 필터 적용
  useEffect(() => {
    /** team:member-select 이벤트 핸들러 */
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

  // notification:click 이벤트 구독 — 알림 클릭 시 해당 태스크 자동 선택
  useEffect(() => {
    /** notification:click 이벤트 핸들러 */
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

  // workspace.selectedMemberId 전역 상태 변경 구독
  useEffect(() => {
    /** workspace:state-change 이벤트 핸들러 */
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

  /** 지정된 상태에 해당하는 태스크 목록을 반환한다. */
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
            칸반 보드 — 상태 칩 클릭으로 태스크 이동, 카드 클릭으로 상세 보기
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {filterMemberId && (
            <Button variant="ghost" size="sm" onClick={() => setFilterMemberId(null)}>
              필터 해제
            </Button>
          )}
          <span style={{ fontSize: '13px', color: '#8b949e' }}>
            {filteredTasks.length}개 태스크
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* 칸반 컬럼 영역 */}
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

        {/* 태스크 상세 패널 */}
        {selectedTask && (
          <div style={{ flex: '0 0 35%', minWidth: '320px' }}>
            <TaskDetail task={selectedTask} onClose={handleCloseDetail} />
          </div>
        )}
      </div>
    </div>
  );
}

/** KanbanColumn 컴포넌트의 props */
interface KanbanColumnProps {
  readonly column: ColumnConfig;
  readonly tasks: readonly Task[];
  readonly selectedTaskId: string | null;
  readonly onTaskClick: (task: Task) => void;
  readonly onStatusChange: (task: Task) => void;
}

/**
 * 칸반 컬럼을 렌더링한다.
 * 컬럼 헤더에 태스크 수를 표시하고, 포함된 태스크 카드를 나열한다.
 */
function KanbanColumn({ column, tasks, selectedTaskId, onTaskClick, onStatusChange }: KanbanColumnProps): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '200px',
      }}
    >
      {/* 컬럼 헤더 */}
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

      {/* 태스크 카드 목록 */}
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
            태스크 없음
          </div>
        )}
      </div>
    </div>
  );
}

/** TaskCard 컴포넌트의 props */
interface TaskCardProps {
  readonly task: Task;
  readonly isSelected: boolean;
  readonly onTaskClick: (task: Task) => void;
  readonly onStatusChange: (task: Task) => void;
}

/**
 * 개별 태스크 카드를 렌더링한다.
 * 카드 클릭으로 상세 보기, 상태 칩 클릭으로 다음 상태로 이동한다.
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
        {/* 우선순위 뱃지 + 태스크 ID */}
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

        {/* 태스크 제목 */}
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

        {/* 담당자 + 상태 이동 칩 */}
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

          {/* 상태 이동 칩 — 클릭으로 다음 상태로 전환 */}
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
            title={`"${nextLabel}"(으)로 이동`}
          >
            → {nextLabel}
          </button>
        </div>
      </div>
    </Card>
  );
}
