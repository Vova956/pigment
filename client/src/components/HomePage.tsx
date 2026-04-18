import { useState } from 'react';
import { config } from '../config';

type View = 'home' | 'login' | 'register' | 'invited';

interface HomePageProps {
  onEnterSession: (sessionId: string, userName: string) => void;
  initialJoinCode?: string | null;
}

export default function HomePage({ onEnterSession, initialJoinCode }: HomePageProps) {
  const [view, setView] = useState<View>(initialJoinCode ? 'invited' : 'home');
  const [joinCode, setJoinCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

  const effectiveName = loggedInUser || guestName.trim();

  function requireName(): boolean {
    if (!effectiveName) {
      setJoinError('Please enter a display name or log in first.');
      return false;
    }
    return true;
  }

  async function handleCreate() {
    if (!requireName()) {
      return;
    }
    setLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${config.apiUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error('Failed to create session');
      }
      const { sessionId } = await res.json();
      onEnterSession(sessionId, effectiveName);
    } catch {
      setJoinError('Could not create session. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(codeOverride?: string) {
    if (!requireName()) {
      return;
    }
    const code = (codeOverride ?? joinCode).trim().toUpperCase();
    if (!code) {
      setJoinError('Enter a session code.');
      return;
    }
    setLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${config.apiUrl}/sessions/${code}`);
      if (res.status === 404) {
        setJoinError('Session not found. Check the code and try again.');
        return;
      }
      if (!res.ok) {
        throw new Error('Server error');
      }
      onEnterSession(code, effectiveName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'Session not found. Check the code and try again.') {
        setJoinError(msg);
      } else {
        setJoinError('Could not reach server.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(thenJoinCode?: string) {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(friendlyAuthError(data.error));
        return;
      }
      setLoggedInUser(data.user.username);
      if (thenJoinCode) {
        onEnterSession(thenJoinCode, data.user.username);
      } else {
        setView(initialJoinCode ? 'invited' : 'home');
      }
    } catch {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  }

  function friendlyAuthError(raw: string): string {
    if (!raw) {
      return 'An error occurred. Please try again.';
    }
    const lower = raw.toLowerCase();
    if (lower.includes('unique') && lower.includes('username')) {
      return 'That username is already taken. Please choose another.';
    }
    if (lower.includes('unique') && lower.includes('email')) {
      return 'An account with that email already exists.';
    }
    if (lower.includes('missing fields')) {
      return 'Please fill in all fields.';
    }
    if (lower.includes('invalid credentials')) {
      return 'Incorrect email or password.';
    }
    return raw;
  }

  async function handleRegister(thenJoinCode?: string) {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${config.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(friendlyAuthError(data.error));
        return;
      }
      const loginRes = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setLoggedInUser(loginData.user.username);
        if (thenJoinCode) {
          onEnterSession(thenJoinCode, loginData.user.username);
        } else {
          setView(initialJoinCode ? 'invited' : 'home');
        }
      } else {
        setAuthError('Registered! Please log in.');
        setView('login');
      }
    } catch {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Auth view (login / register) ────────────────────────────────────────────
  if (view === 'login' || view === 'register') {
    const returnCode = initialJoinCode ?? undefined;
    return (
      <div className="home-page">
        <div className="home-center">
          <div className="home-brand">
            <div className="home-brand-icon">P</div>
            <span className="home-brand-name">Pigment</span>
          </div>

          <div className="auth-card">
            <div className="auth-tabs">
              <button
                className={`auth-tab${view === 'login' ? ' active' : ''}`}
                onClick={() => {
                  setView('login');
                  setAuthError('');
                }}
              >
                Log in
              </button>
              <button
                className={`auth-tab${view === 'register' ? ' active' : ''}`}
                onClick={() => {
                  setView('register');
                  setAuthError('');
                }}
              >
                Sign up
              </button>
            </div>

            <div className="auth-form">
              {view === 'register' && (
                <div className="form-field">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="yourname"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                  />
                </div>
              )}
              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void (view === 'login'
                        ? handleLogin(returnCode)
                        : handleRegister(returnCode));
                    }
                  }}
                />
              </div>
              {authError && <div className="form-error">{authError}</div>}
              <button
                className="btn-primary"
                onClick={() => {
                  void (view === 'login' ? handleLogin(returnCode) : handleRegister(returnCode));
                }}
                disabled={authLoading}
              >
                {authLoading ? '...' : view === 'login' ? 'Log in' : 'Create account'}
              </button>
            </div>

            <button
              className="auth-back"
              onClick={() => setView(initialJoinCode ? 'invited' : 'home')}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Invited view (followed a share link) ────────────────────────────────────
  if (view === 'invited' && initialJoinCode) {
    return (
      <div className="home-page">
        <div className="home-center">
          <div className="home-brand">
            <div className="home-brand-icon">P</div>
            <span className="home-brand-name">Pigment</span>
          </div>

          <div className="auth-card">
            <div className="session-card-icon" style={{ fontSize: 20, marginBottom: 4 }}>
              →
            </div>
            <div
              className="session-card-title"
              style={{ color: 'white', fontSize: 18, marginBottom: 4 }}
            >
              You&apos;ve been invited
            </div>
            <div style={{ color: 'var(--slate-400)', fontSize: 13, marginBottom: 16 }}>
              Session code:{' '}
              <span style={{ color: 'white', fontWeight: 700, letterSpacing: 2 }}>
                {initialJoinCode}
              </span>
            </div>

            {loggedInUser ? (
              <>
                <div className="logged-in-row" style={{ marginBottom: 12 }}>
                  <span className="logged-in-label">
                    Joining as <strong>{loggedInUser}</strong>
                  </span>
                  <button className="link-btn" onClick={() => setLoggedInUser(null)}>
                    Change
                  </button>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    void handleJoin(initialJoinCode);
                  }}
                  disabled={loading}
                >
                  {loading ? 'Joining…' : 'Join Canvas'}
                </button>
              </>
            ) : (
              <>
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label className="form-label">Your display name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      setJoinError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleJoin(initialJoinCode);
                      }
                    }}
                    maxLength={30}
                    autoFocus
                  />
                </div>
                {joinError && (
                  <div className="form-error" style={{ marginBottom: 8 }}>
                    {joinError}
                  </div>
                )}
                <button
                  className="btn-primary"
                  onClick={() => {
                    void handleJoin(initialJoinCode);
                  }}
                  disabled={loading}
                >
                  {loading ? 'Joining…' : 'Join Canvas'}
                </button>
                <div className="auth-link-row" style={{ justifyContent: 'center', marginTop: 12 }}>
                  <button className="link-btn" onClick={() => setView('login')}>
                    Log in
                  </button>
                  <span className="auth-sep">·</span>
                  <button className="link-btn" onClick={() => setView('register')}>
                    Sign up
                  </button>
                  <span className="auth-sep">instead</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Home view ────────────────────────────────────────────────────────────────
  return (
    <div className="home-page">
      <div className="home-center">
        <div className="home-brand">
          <div className="home-brand-icon">P</div>
          <span className="home-brand-name">Pigment</span>
        </div>
        <p className="home-tagline">Real-time collaborative drawing</p>

        {!loggedInUser ? (
          <div className="guest-row">
            <input
              className="form-input"
              type="text"
              placeholder="Your display name (required)"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setJoinError('');
              }}
              maxLength={30}
            />
          </div>
        ) : (
          <div className="logged-in-row">
            <span className="logged-in-label">
              Signed in as <strong>{loggedInUser}</strong>
            </span>
            <button className="link-btn" onClick={() => setLoggedInUser(null)}>
              Sign out
            </button>
          </div>
        )}

        <div className="session-cards">
          <div className="session-card">
            <div className="session-card-icon">+</div>
            <div className="session-card-title">New Session</div>
            <div className="session-card-desc">
              Start a fresh canvas and invite others with a code.
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                void handleCreate();
              }}
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>

          <div className="session-card">
            <div className="session-card-icon">→</div>
            <div className="session-card-title">Join Session</div>
            <div className="session-card-desc">
              Enter a 6-character code to join an existing canvas.
            </div>
            <input
              className="form-input code-input"
              type="text"
              placeholder="ABC123"
              maxLength={200}
              value={joinCode}
              onChange={(e) => {
                let val = e.target.value;
                // Extract session code from a pasted share URL
                try {
                  const u = new URL(val.trim());
                  const code = u.searchParams.get('session');
                  if (code) {
                    val = code;
                  }
                } catch {
                  // not a URL — treat input as a raw code
                }
                setJoinCode(val.toUpperCase().slice(0, 6));
                setJoinError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleJoin();
                }
              }}
            />
            <button
              className="btn-secondary"
              onClick={() => {
                void handleJoin();
              }}
              disabled={loading}
            >
              {loading ? 'Joining…' : 'Join Session'}
            </button>
          </div>
        </div>

        {joinError && <div className="form-error join-error">{joinError}</div>}

        {!loggedInUser && (
          <div className="auth-link-row">
            <button className="link-btn" onClick={() => setView('login')}>
              Log in
            </button>
            <span className="auth-sep">·</span>
            <button className="link-btn" onClick={() => setView('register')}>
              Sign up
            </button>
            <span className="auth-sep">to save your sessions</span>
          </div>
        )}
      </div>
    </div>
  );
}
