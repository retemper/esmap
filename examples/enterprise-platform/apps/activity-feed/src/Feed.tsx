import { useState, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';

/** 활동 항목 */
interface ActivityItem {
  readonly id: string;
  readonly type: 'create' | 'update' | 'delete' | 'comment';
  readonly user: string;
  readonly message: string;
  readonly time: string;
}

/** 데모 활동 데이터 */
const DEMO_ACTIVITIES: readonly ActivityItem[] = [
  { id: '1', type: 'create', user: '김민혁', message: '새 프로젝트 "Q1 OKR"을 생성했습니다', time: '2분 전' },
  { id: '2', type: 'update', user: '이서연', message: '팀 목록을 업데이트했습니다', time: '15분 전' },
  { id: '3', type: 'comment', user: '박지훈', message: '"주간 회고" 문서에 댓글을 달았습니다', time: '1시간 전' },
  { id: '4', type: 'delete', user: '최수빈', message: '만료된 초대 링크를 삭제했습니다', time: '2시간 전' },
  { id: '5', type: 'create', user: '정다은', message: '새 팀원 "한소리"를 추가했습니다', time: '3시간 전' },
  { id: '6', type: 'update', user: '김민혁', message: '대시보드 위젯 순서를 변경했습니다', time: '4시간 전' },
  { id: '7', type: 'comment', user: '이서연', message: '"기술 스택 선정" 문서에 피드백을 남겼습니다', time: '5시간 전' },
  { id: '8', type: 'create', user: '박지훈', message: '새 채널 "#architecture"를 개설했습니다', time: '어제' },
];

/** 활동 타입별 아이콘 */
const typeIcons: Record<string, string> = {
  create: '+',
  update: '~',
  delete: '-',
  comment: '#',
};

/** 활동 타입별 색상 */
const typeColors: Record<string, string> = {
  create: '#16a34a',
  update: '#2563eb',
  delete: '#dc2626',
  comment: '#7c3aed',
};

/** Feed 컴포넌트 props */
interface FeedProps {
  /** 표시 모드: 'page'(전체 페이지) 또는 'widget'(Parcel 임베드) */
  readonly mode?: 'page' | 'widget';
  /** 최대 표시 항목 수 (widget 모드에서 제한용) */
  readonly maxItems?: number;
}

/**
 * Activity Feed 뷰.
 * props.mode에 따라 전체 페이지 레이아웃 또는 컴팩트 위젯으로 렌더링한다.
 */
export function Feed(props: FeedProps): ReactNode {
  const mode = props.mode ?? 'page';
  const maxItems = props.maxItems ?? DEMO_ACTIVITIES.length;
  const [filter, setFilter] = useState<string>('all');

  const filtered = DEMO_ACTIVITIES.filter(
    (item) => filter === 'all' || item.type === filter,
  ).slice(0, maxItems);

  // ─── Widget 모드: 컴팩트 렌더링 ───
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
            <span style={{ color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>
              {item.time}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Page 모드: 전체 페이지 레이아웃 ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Activity Feed</h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        듀얼 모드 MFE — 이 뷰는 독립 라우트 (/activity) 및 Dashboard Parcel 위젯으로 동작합니다
      </p>

      {/* 필터 버튼 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['all', 'create', 'update', 'delete', 'comment'].map((type) => (
          <Button
            key={type}
            variant={filter === type ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {type === 'all' ? '전체' : type}
          </Button>
        ))}
      </div>

      {/* 활동 목록 */}
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
