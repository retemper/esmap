import { useState, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';

/** Lazy-loads MemberDetail (code splitting within the MFE) */
const MemberDetail = lazy(() => import('./MemberDetail.js'));

/** TeamList rendering mode */
type TeamListMode = 'page' | 'sidebar';

/** Props received by TeamList from outside */
export interface TeamListProps extends Record<string, unknown> {
  /** Rendering mode — 'page' (default) is full layout, 'sidebar' is compact layout */
  readonly mode?: TeamListMode;
}

/** Team member data */
interface Member {
  readonly id: string;
  readonly name: string;
  readonly team: string;
  readonly role: string;
  readonly email: string;
  readonly joinDate: string;
}

/** Detail type for the member-select custom event */
interface MemberSelectDetail {
  readonly memberId: string;
  readonly memberName: string;
}

/**
 * Dispatches a member-select custom event.
 * @param memberId - unique ID of the selected member
 * @param memberName - name of the selected member
 */
function emitMemberSelect(memberId: string, memberName: string): void {
  const detail: MemberSelectDetail = { memberId, memberName };
  window.dispatchEvent(new CustomEvent('esmap:team:member-select', { detail }));
}

/** Dispatches a member-deselect custom event. */
function emitMemberDeselect(): void {
  window.dispatchEvent(new CustomEvent('esmap:team:member-deselect'));
}

/** Demo team member list — IDs follow the 'user-N' pattern for cross-referencing with task-board */
const MEMBERS: readonly Member[] = [
  { id: 'user-1', name: 'Minhyeok Kim', team: 'Platform', role: 'Tech Lead', email: 'minhyeok@enterprise.dev', joinDate: '2023-01' },
  { id: 'user-2', name: 'Seoyeon Lee', team: 'Platform', role: 'Frontend Engineer', email: 'seoyeon@enterprise.dev', joinDate: '2023-03' },
  { id: 'user-3', name: 'Jihoon Park', team: 'Analytics', role: 'Backend Engineer', email: 'jihoon@enterprise.dev', joinDate: '2023-06' },
  { id: 'user-4', name: 'Subin Choi', team: 'Analytics', role: 'Data Engineer', email: 'subin@enterprise.dev', joinDate: '2024-01' },
  { id: 'user-5', name: 'Daeun Jeong', team: 'HR', role: 'Product Manager', email: 'daeun@enterprise.dev', joinDate: '2023-09' },
  { id: 'user-6', name: 'Sori Han', team: 'HR', role: 'Designer', email: 'sori@enterprise.dev', joinDate: '2024-03' },
  { id: 'user-7', name: 'Hyunwoo Oh', team: 'Platform', role: 'SRE', email: 'hyunwoo@enterprise.dev', joinDate: '2024-02' },
  { id: 'user-8', name: 'Chaerin Yoon', team: 'Analytics', role: 'Frontend Engineer', email: 'chaerin@enterprise.dev', joinDate: '2024-06' },
];

/** Team list */
const TEAMS = ['All', 'Platform', 'Analytics', 'HR'] as const;

/**
 * Team member list view.
 * State (search term, filter, selected member) is preserved by keepAlive.
 * MemberDetail is code-split via lazy().
 *
 * mode='page' (default): full layout with search bar, filters, and 2-column detail panel.
 * mode='sidebar': compact single-column layout without search bar, dispatches member selection events.
 */
export function TeamList({ mode = 'page' }: TeamListProps): ReactNode {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const isSidebar = mode === 'sidebar';

  /** Toggles selection state and dispatches custom event on member click */
  const handleMemberClick = useCallback(
    (member: Member) => {
      if (selectedMemberId === member.id) {
        setSelectedMemberId(null);
        emitMemberDeselect();
      } else {
        setSelectedMemberId(member.id);
        emitMemberSelect(member.id, member.name);
      }
    },
    [selectedMemberId],
  );

  /** Clears selection and dispatches deselect event */
  const handleClear = useCallback(() => {
    setSelectedMemberId(null);
    emitMemberDeselect();
  }, []);

  const filtered = MEMBERS.filter((m) => {
    const matchesSearch = m.name.includes(search) || m.email.includes(search) || m.role.includes(search);
    const matchesTeam = teamFilter === 'All' || m.team === teamFilter;
    return matchesSearch && matchesTeam;
  });

  const selectedMember = MEMBERS.find((m) => m.id === selectedMemberId);

  if (isSidebar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Team</h2>
          {selectedMemberId !== null && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>

        {/* Team filter (compact) */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {TEAMS.map((team) => (
            <Button
              key={team}
              variant={teamFilter === team ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTeamFilter(team)}
            >
              {team}
            </Button>
          ))}
        </div>

        {/* Compact member list — single column, small avatars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No results
            </div>
          )}
          {filtered.map((member) => (
            <Card
              key={member.id}
              padding="sm"
              style={{
                cursor: 'pointer',
                border: selectedMemberId === member.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                transition: 'border-color 0.15s',
              }}
              onClick={() => handleMemberClick(member)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#475569',
                    flexShrink: 0,
                  }}
                >
                  {member.name.slice(0, 1)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{member.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{member.role}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Team Directory</h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        keepAlive state preservation demo — search terms and selection state persist across page navigations
      </p>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            background: '#ffffff',
          }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {TEAMS.map((team) => (
            <Button
              key={team}
              variant={teamFilter === team ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTeamFilter(team)}
            >
              {team}
            </Button>
          ))}
        </div>
        {selectedMemberId !== null && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMember ? '1fr 1fr' : '1fr', gap: '16px' }}>
        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              No search results found
            </div>
          )}
          {filtered.map((member) => (
            <Card
              key={member.id}
              padding="sm"
              style={{
                cursor: 'pointer',
                border: selectedMemberId === member.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                transition: 'border-color 0.15s',
              }}
              onClick={() => handleMemberClick(member)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{member.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {member.role} · {member.team}
                  </div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: '#f1f5f9',
                    color: '#475569',
                  }}
                >
                  {member.team}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Detail: lazy sub-module (code splitting) */}
        {selectedMember && (
          <Suspense
            fallback={
              <Card>
                <div style={{ padding: '24px', color: '#94a3b8', textAlign: 'center' }}>
                  Loading details... (lazy sub-module)
                </div>
              </Card>
            }
          >
            <MemberDetail member={selectedMember} onClose={handleClear} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
