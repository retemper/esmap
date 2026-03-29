import type { ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';
import { RecentActivity } from './widgets/RecentActivity.js';

/**
 * 대시보드 메인 뷰.
 * 디자인 시스템 컴포넌트를 import map 경유로 사용하고,
 * activity-feed MFE를 Parcel로 임베드한다.
 */
export function Dashboard(): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Dashboard</h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        중첩 Parcel + 공유 디자인 시스템 + 전역 상태 시연
      </p>

      {/* 통계 카드 — @enterprise/design-system Card 사용 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <Card title="총 사용자">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#2563eb' }}>1,284</div>
          <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '4px' }}>+12.5%</div>
        </Card>
        <Card title="활성 팀">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#7c3aed' }}>42</div>
          <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '4px' }}>+3</div>
        </Card>
        <Card title="이번 주 활동">
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#d97706' }}>567</div>
          <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>-8.2%</div>
        </Card>
      </div>

      {/* 액션 버튼 — @enterprise/design-system Button 사용 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" size="sm">
          새 사용자 추가
        </Button>
        <Button variant="secondary" size="sm">
          보고서 내보내기
        </Button>
        <Button variant="ghost" size="sm">
          설정
        </Button>
      </div>

      {/* 중첩 Parcel: activity-feed MFE를 위젯으로 임베드 */}
      <Card title="최근 활동 (Parcel 위젯)" padding="sm">
        <RecentActivity />
      </Card>
    </div>
  );
}
