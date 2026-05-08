import React, {useState, useEffect, type FormEvent} from 'react';

const STORAGE_KEY = 'curia_truth_auth_v1';
const PASSWORD_LOWER = 'noah';
const SHARE_PARAM = 'key';

export default function Root({children}: {children: React.ReactNode}): React.ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    try {
      // Auto-unlock from share-link query param (e.g. ?key=noah).
      const params = new URLSearchParams(window.location.search);
      const sharedKey = params.get(SHARE_PARAM);
      if (sharedKey && sharedKey.trim().toLowerCase() === PASSWORD_LOWER) {
        try {
          window.localStorage.setItem(STORAGE_KEY, 'yes');
        } catch {
          // localStorage unavailable — still unlock for this session
        }
        setAuthed(true);

        // Clean the URL so the password doesn't linger in history / shares.
        params.delete(SHARE_PARAM);
        const remaining = params.toString();
        const cleaned =
          window.location.pathname +
          (remaining ? `?${remaining}` : '') +
          window.location.hash;
        window.history.replaceState({}, '', cleaned);
        return;
      }

      if (window.localStorage.getItem(STORAGE_KEY) === 'yes') {
        setAuthed(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — stay locked
    }
  }, []);

  if (!mounted) {
    return null;
  }

  if (!authed) {
    const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      if (input.trim().toLowerCase() === PASSWORD_LOWER) {
        try {
          window.localStorage.setItem(STORAGE_KEY, 'yes');
        } catch {
          // ignore — session-only auth still works in-memory
        }
        setAuthed(true);
        setError(false);
      } else {
        setError(true);
      }
    };

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'var(--color-paper, #faf7f1)',
          color: 'var(--color-ink, #1a1a1a)',
          zIndex: 9999,
          fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--color-ink, #1a1a1a)',
              fontWeight: 500,
            }}
          >
            Curia Regis · Truth Wiki
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontWeight: 300,
              fontSize: '2.25rem',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            Enter
          </h1>
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(false);
            }}
            autoFocus
            aria-label="Password"
            style={{
              padding: '0.75rem 0',
              fontSize: '1rem',
              border: 'none',
              borderBottom: '1px solid var(--color-ink, #1a1a1a)',
              borderRadius: 0,
              background: 'transparent',
              color: 'inherit',
              outline: 'none',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          />
          {error && (
            <div
              role="alert"
              style={{
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-red, #a91b26)',
              }}
            >
              Wrong
            </div>
          )}
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 500,
              border: '1px solid var(--color-ink, #1a1a1a)',
              borderRadius: 0,
              background: 'var(--color-ink, #1a1a1a)',
              color: 'var(--color-paper, #faf7f1)',
              cursor: 'pointer',
            }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
