import { useState, type ReactNode, type FormEvent } from 'react';

/** 데모용 사용자 계정 */
const DEMO_USERS = [
  { id: 'user-1', name: '김민혁', email: 'minhyeok@enterprise.dev' },
  { id: 'user-2', name: '이서연', email: 'seoyeon@enterprise.dev' },
] as const;

/**
 * 로그인 폼을 렌더링하고, 인증 성공 시 CustomEvent로 host에 전파한다.
 * MFE 간 느슨한 결합을 위해 window CustomEvent를 브릿지로 사용한다.
 */
export function LoginForm(): ReactNode {
  const [selectedUser, setSelectedUser] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setIsLoading(true);

    // 인증 시뮬레이션 (500ms 지연)
    setTimeout(() => {
      const user = DEMO_USERS[selectedUser];

      // host의 eventBus로 인증 완료 이벤트 전파
      // CustomEvent 브릿지: MFE → host 간 느슨한 결합
      window.dispatchEvent(
        new CustomEvent('esmap:auth:login', {
          detail: { userId: user.id, name: user.name },
        }),
      );

      setIsLoading(false);
    }, 500);
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        width: '380px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    >
      <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1e293b' }}>
        Enterprise Platform
      </h2>
      <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>
        ReadyGate 인증 데모 — 로그인 전까지 보호된 라우트 차단
      </p>

      <form onSubmit={handleSubmit}>
        <label
          style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#475569' }}
        >
          사용자 선택
        </label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            marginBottom: '16px',
            background: '#f8fafc',
          }}
        >
          {DEMO_USERS.map((user, idx) => (
            <option key={user.id} value={idx}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: isLoading ? '#94a3b8' : '#2563eb',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '인증 중...' : '로그인'}
        </button>
      </form>

      <p
        style={{
          marginTop: '16px',
          fontSize: '11px',
          color: '#94a3b8',
          textAlign: 'center',
        }}
      >
        이 MFE는 ReadyGate에 의해 인증 완료 전까지 표시됩니다
      </p>
    </div>
  );
}
