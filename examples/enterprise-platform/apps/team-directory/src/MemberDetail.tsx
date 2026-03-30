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
 * Team member detail view.
 * Code-split via lazy() and loaded only when needed inside the MFE.
 *
 * Demo points:
 * - Dynamic import within MFE (code splitting) — a sub-module, not a separate MFE
 * - This file is only downloaded when a team member is selected
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
            Close
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
          <span style={{ color: '#94a3b8', fontWeight: '500' }}>Team</span>
          <span>{member.team}</span>

          <span style={{ color: '#94a3b8', fontWeight: '500' }}>Email</span>
          <span>{member.email}</span>

          <span style={{ color: '#94a3b8', fontWeight: '500' }}>Join Date</span>
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
          This component is code-split via <code>lazy()</code> and is only
          downloaded when a team member is selected. (MFE internal sub-module)
        </div>
      </div>
    </Card>
  );
}
