import { useState, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { Card, Button } from '@enterprise/design-system';

/** MemberDetail을 레이지 로드한다 (MFE 내부 코드 스플리팅) */
const MemberDetail = lazy(() => import('./MemberDetail.js'));

/** TeamList 렌더링 모드 */
type TeamListMode = 'page' | 'sidebar';

/** TeamList가 외부로부터 받는 props */
export interface TeamListProps extends Record<string, unknown> {
  /** 렌더링 모드 — 'page'(기본)는 전체 레이아웃, 'sidebar'는 컴팩트 레이아웃 */
  readonly mode?: TeamListMode;
}

/** 팀원 데이터 */
interface Member {
  readonly id: string;
  readonly name: string;
  readonly team: string;
  readonly role: string;
  readonly email: string;
  readonly joinDate: string;
}

/** member-select 커스텀 이벤트의 detail 타입 */
interface MemberSelectDetail {
  readonly memberId: string;
  readonly memberName: string;
}

/**
 * 멤버 선택 커스텀 이벤트를 발행한다.
 * @param memberId - 선택된 멤버의 고유 ID
 * @param memberName - 선택된 멤버의 이름
 */
function emitMemberSelect(memberId: string, memberName: string): void {
  const detail: MemberSelectDetail = { memberId, memberName };
  window.dispatchEvent(new CustomEvent('esmap:team:member-select', { detail }));
}

/** 멤버 선택 해제 커스텀 이벤트를 발행한다. */
function emitMemberDeselect(): void {
  window.dispatchEvent(new CustomEvent('esmap:team:member-deselect'));
}

/** 데모 팀원 목록 — ID는 'user-N' 패턴으로 task-board와 교차 참조 가능 */
const MEMBERS: readonly Member[] = [
  { id: 'user-1', name: '김민혁', team: 'Platform', role: 'Tech Lead', email: 'minhyeok@enterprise.dev', joinDate: '2023-01' },
  { id: 'user-2', name: '이서연', team: 'Platform', role: 'Frontend Engineer', email: 'seoyeon@enterprise.dev', joinDate: '2023-03' },
  { id: 'user-3', name: '박지훈', team: 'Analytics', role: 'Backend Engineer', email: 'jihoon@enterprise.dev', joinDate: '2023-06' },
  { id: 'user-4', name: '최수빈', team: 'Analytics', role: 'Data Engineer', email: 'subin@enterprise.dev', joinDate: '2024-01' },
  { id: 'user-5', name: '정다은', team: 'HR', role: 'Product Manager', email: 'daeun@enterprise.dev', joinDate: '2023-09' },
  { id: 'user-6', name: '한소리', team: 'HR', role: 'Designer', email: 'sori@enterprise.dev', joinDate: '2024-03' },
  { id: 'user-7', name: '오현우', team: 'Platform', role: 'SRE', email: 'hyunwoo@enterprise.dev', joinDate: '2024-02' },
  { id: 'user-8', name: '윤채린', team: 'Analytics', role: 'Frontend Engineer', email: 'chaerin@enterprise.dev', joinDate: '2024-06' },
];

/** 팀 목록 */
const TEAMS = ['전체', 'Platform', 'Analytics', 'HR'] as const;

/**
 * 팀원 목록 뷰.
 * keepAlive에 의해 상태(검색어, 필터, 선택된 멤버)가 보존된다.
 * MemberDetail은 lazy()로 코드 스플리팅된다.
 *
 * mode='page' (기본): 검색바, 필터, 2컬럼 상세 패널 포함 전체 레이아웃.
 * mode='sidebar': 검색바 없이 컴팩트 단일 컬럼 레이아웃, 멤버 선택 이벤트 발행.
 */
export function TeamList({ mode = 'page' }: TeamListProps): ReactNode {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('전체');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const isSidebar = mode === 'sidebar';

  /** 멤버 클릭 시 선택 상태 토글 및 커스텀 이벤트 발행 */
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

  /** 선택 해제 및 deselect 이벤트 발행 */
  const handleClear = useCallback(() => {
    setSelectedMemberId(null);
    emitMemberDeselect();
  }, []);

  const filtered = MEMBERS.filter((m) => {
    const matchesSearch = m.name.includes(search) || m.email.includes(search) || m.role.includes(search);
    const matchesTeam = teamFilter === '전체' || m.team === teamFilter;
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

        {/* 팀 필터 (컴팩트) */}
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

        {/* 컴팩트 멤버 목록 — 단일 컬럼, 작은 아바타 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              결과 없음
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
        keepAlive 상태 보존 시연 — 다른 페이지로 이동했다 돌아와도 검색어와 선택 상태가 유지됩니다
      </p>

      {/* 검색 + 필터 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 이메일, 역할 검색..."
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
        {/* 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              검색 결과가 없습니다
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

        {/* 상세: lazy 서브모듈 (코드 스플리팅) */}
        {selectedMember && (
          <Suspense
            fallback={
              <Card>
                <div style={{ padding: '24px', color: '#94a3b8', textAlign: 'center' }}>
                  상세 정보 로드 중... (lazy sub-module)
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
