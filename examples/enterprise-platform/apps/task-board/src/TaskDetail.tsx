import type { ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { EsmapParcel } from '@esmap/react';
import type { MfeApp } from '@esmap/shared';

/** 태스크 우선순위 */
type Priority = 'high' | 'medium' | 'low';

/** TaskDetail 컴포넌트에 전달되는 태스크 데이터 구조 */
interface TaskDetailTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly priority: Priority;
  readonly status: string;
}

/** TaskDetail 컴포넌트의 props */
interface TaskDetailProps {
  /** 표시할 태스크 데이터 */
  readonly task: TaskDetailTask;
  /** 상세 패널 닫기 콜백 */
  readonly onClose: () => void;
}

/** 우선순위별 레이블 매핑 */
const PRIORITY_LABELS: Record<Priority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

/** 우선순위별 색상 매핑 */
const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#f85149',
  medium: '#d29922',
  low: '#3fb950',
};

/** 상태별 레이블 매핑 */
const STATUS_LABELS: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
};

/**
 * Activity Feed MFE를 비동기 로드하여 MfeApp을 반환한다.
 * default export를 추출하여 EsmapParcel이 기대하는 타입에 맞춘다.
 */
async function loadActivityFeed(): Promise<MfeApp> {
  const mod = await import(/* @vite-ignore */ '@enterprise/activity-feed');
  return mod.default;
}

/**
 * 태스크 상세 정보를 드로어 형태로 표시한다.
 * 하단에 activity-feed MFE를 Parcel로 임베드하여 태스크 관련 활동 내역을 보여준다.
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
      {/* 헤더 — 제목 + 닫기 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: '#484f58', marginBottom: '4px', display: 'block' }}>
            {task.id}
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#e6edf3', lineHeight: '1.4' }}>
            {task.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* 메타 정보 */}
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
        {/* 상태 */}
        <div>
          <div style={{ fontSize: '11px', color: '#484f58', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            상태
          </div>
          <div style={{ fontSize: '13px', color: '#e6edf3' }}>
            {STATUS_LABELS[task.status] ?? task.status}
          </div>
        </div>

        {/* 우선순위 */}
        <div>
          <div style={{ fontSize: '11px', color: '#484f58', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            우선순위
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

        {/* 담당자 */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: '11px', color: '#484f58', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            담당자
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

      {/* 설명 */}
      <div>
        <div style={{ fontSize: '11px', color: '#484f58', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
          설명
        </div>
        <p style={{ fontSize: '14px', color: '#c9d1d9', margin: 0, lineHeight: '1.6' }}>
          {task.description}
        </p>
      </div>

      {/* 임베디드 Activity Feed — Parcel 위젯 */}
      <Card title={`${task.id} 관련 활동`} padding="sm">
        <EsmapParcel
          app={loadActivityFeed}
          appProps={{ mode: 'widget', maxItems: 3 }}
          loading={
            <div style={{ padding: '12px', color: '#8b949e', fontSize: '13px' }}>
              Activity Feed 로드 중...
            </div>
          }
          errorFallback={(error) => (
            <div style={{ padding: '12px', color: '#f85149', fontSize: '13px' }}>
              Activity Feed 로드 실패: {error.message}
            </div>
          )}
          className="task-activity-widget"
        />
      </Card>
    </div>
  );
}
