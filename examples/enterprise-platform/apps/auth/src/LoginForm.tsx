import { useState, type ReactNode, type FormEvent } from 'react';

/** Demo user accounts */
const DEMO_USERS = [
  { id: 'user-1', name: 'Minhyeok Kim', email: 'minhyeok@enterprise.dev' },
  { id: 'user-2', name: 'Seoyeon Lee', email: 'seoyeon@enterprise.dev' },
] as const;

/**
 * Renders a login form and propagates authentication success to the host via CustomEvent.
 * Uses window CustomEvent as a bridge for loose coupling between MFEs.
 */
export function LoginForm(): ReactNode {
  const [selectedUser, setSelectedUser] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setIsLoading(true);

    // Authentication simulation (500ms delay)
    setTimeout(() => {
      const user = DEMO_USERS[selectedUser];

      // Propagate authentication completion event to host's eventBus
      // CustomEvent bridge: loose coupling between MFE and host
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
        ReadyGate auth demo — protected routes are blocked until login
      </p>

      <form onSubmit={handleSubmit}>
        <label
          style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#475569' }}
        >
          Select user
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
          {isLoading ? 'Authenticating...' : 'Log in'}
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
        This MFE is displayed by ReadyGate until authentication is complete
      </p>
    </div>
  );
}
