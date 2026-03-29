import { useState, useEffect, type ReactNode } from 'react';

/** 대시보드 위젯 데이터 */
interface Widget {
  readonly id: string;
  readonly title: string;
  readonly value: number;
  readonly trend: 'up' | 'down' | 'stable';
}

/** 초기 위젯 데이터 */
const INITIAL_WIDGETS: readonly Widget[] = [
  { id: 'users', title: '활성 사용자', value: 1247, trend: 'up' },
  { id: 'revenue', title: '매출', value: 89400, trend: 'up' },
  { id: 'orders', title: '주문', value: 342, trend: 'stable' },
  { id: 'returns', title: '반품', value: 12, trend: 'down' },
];

/** 트렌드 아이콘을 반환한다 */
function trendIcon(trend: Widget['trend']): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'stable':
      return '→';
  }
}

/** 트렌드 색상을 반환한다 */
function trendColor(trend: Widget['trend']): string {
  switch (trend) {
    case 'up':
      return '#22c55e';
    case 'down':
      return '#ef4444';
    case 'stable':
      return '#6b7280';
  }
}

/** 위젯 카드 컴포넌트 */
function WidgetCard({ widget }: { readonly widget: Widget }): ReactNode {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        minWidth: '180px',
        flex: 1,
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>{widget.title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 700 }}>
          {widget.value.toLocaleString()}
        </span>
        <span style={{ color: trendColor(widget.trend), fontSize: '16px' }}>
          {trendIcon(widget.trend)}
        </span>
      </div>
    </div>
  );
}

/** React 대시보드 메인 컴포넌트 */
export function Dashboard(): ReactNode {
  const [widgets] = useState<readonly Widget[]>(INITIAL_WIDGETS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('[React Dashboard] mounted via @esmap/react');
    return () => {
      console.log('[React Dashboard] unmounted');
    };
  }, []);

  return (
    <div
      style={{
        padding: '32px',
        background: '#0f172a',
        color: '#f1f5f9',
        minHeight: '300px',
        fontFamily: 'system-ui, sans-serif',
      }}
      data-testid="react-dashboard"
    >
      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>React Dashboard</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>
        @esmap/react로 마운트된 React MFE
        {mounted && <span style={{ color: '#22c55e', marginLeft: '8px' }}>● Live</span>}
      </p>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {widgets.map((widget) => (
          <WidgetCard key={widget.id} widget={widget} />
        ))}
      </div>

      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          background: '#1e293b',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#94a3b8',
        }}
      >
        <strong style={{ color: '#f1f5f9' }}>기술 스택:</strong> React{' '}
        {/* @ts-expect-error React.version exists at runtime */}
        {typeof React !== 'undefined' ? React.version : '19'} + @esmap/react + createReactMfeApp
      </div>
    </div>
  );
}
