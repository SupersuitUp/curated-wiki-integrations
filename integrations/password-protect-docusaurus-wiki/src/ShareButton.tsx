import React, {useCallback, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const SHARE_PARAM = 'key';

export default function ShareButton(): React.ReactElement | null {
  // Shares the same password as Root.tsx via siteConfig.customFields.wikiPassword.
  // No env-var or constant duplication — single source of truth in docusaurus.config.ts.
  const {siteConfig} = useDocusaurusContext();
  const shareValue = String(siteConfig.customFields?.wikiPassword ?? '');

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (shareValue) {
      url.searchParams.set(SHARE_PARAM, shareValue);
    }
    const shareUrl = url.toString();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
  }, [shareValue]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        margin: '0 0 1rem',
      }}
    >
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy share link with password"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.75rem',
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: '10px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 500,
          border: '1px solid var(--color-rule, rgba(26, 26, 26, 0.14))',
          borderRadius: 0,
          background: 'transparent',
          color: copied ? 'var(--color-red, #a91b26)' : 'var(--color-ink, #1a1a1a)',
          cursor: 'pointer',
          transition: 'border-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--color-ink, #1a1a1a)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-rule, rgba(26, 26, 26, 0.14))';
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 20 20"
          aria-hidden="true"
          style={{flexShrink: 0}}
        >
          {copied ? (
            <path
              fill="currentColor"
              d="M7.629 14.566 3.343 10.28l1.414-1.415 2.872 2.872 7.728-7.729 1.415 1.415z"
            />
          ) : (
            <path
              fill="currentColor"
              d="M11.243 9.343a4 4 0 0 1 0 5.657l-2.829 2.829a4 4 0 0 1-5.657-5.657l1.415-1.415 1.414 1.414-1.414 1.415a2 2 0 0 0 2.828 2.828l2.829-2.828a2 2 0 0 0 0-2.829zm-2.486 1.314a4 4 0 0 1 0-5.657l2.829-2.829a4 4 0 0 1 5.657 5.657l-1.415 1.415-1.414-1.414 1.414-1.415a2 2 0 0 0-2.828-2.828L9.171 6.515a2 2 0 0 0 0 2.829z"
            />
          )}
        </svg>
        <span>{copied ? 'Link copied' : 'Copy share link'}</span>
      </button>
    </div>
  );
}
