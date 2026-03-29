import type { ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';

/** MemberDetail props */
interface MemberDetailProps {
  readonly member: {
    readonly id: string;
    readonly name: string;
    readonly team: string;
    readonly role: string;
    readonly email: string;
    readonly joinDate: string;
  };
  readonly onClose: () => void;
}

/**
 * 팀원 상세 정보 뷰.
 * lazy()로 코드 스플리팅되어 MFE 내부에서 필요할 때만 로드된다.
 *
 * 시연 포인트:
 * - MFE 내부 동적 import (코드 스플리팅) — 별도 MFE가 아닌 서브모듈
 * - 이 파일은 팀원 선택 시에만 다운로드된다
 */
export default function MemberDetail({ member, onClose }: MemberDetailProps): ReactNode {
  return (
    <Card padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{member.name}</h2>
            <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{member.role}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>

        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '700',
            color: '#475569',
          }}
        >
          {member.name.slice(0, 1)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '14px' }}>
          <span style={{ color: '#94a3b8', fontWeight: '500' }}>팀</span>
          <span>{member.team}</span>

          <span style={{ color: '#94a3b8', fontWeight: '500' }}>이메일</span>
          <span>{member.email}</span>

          <span style={{ color: '#94a3b8', fontWeight: '500' }}>입사일</span>
          <span>{member.joinDate}</span>

          <span style={{ color: '#94a3b8', fontWeight: '500' }}>ID</span>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
            {member.id}
          </span>
        </div>

        <div
          style={{
            marginTop: '8px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#94a3b8',
          }}
        >
          이 컴포넌트는 <code>lazy()</code>로 코드 스플리팅되어, 팀원 선택 시에만
          다운로드됩니다. (MFE 내부 서브모듈)
        </div>
      </div>
    </Card>
  );
}
