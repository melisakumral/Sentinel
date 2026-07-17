import { Component, type ContextType, type ErrorInfo, type ReactNode } from 'react';
import { LanguageContext } from './i18n/LanguageContext';
import type { TranslationKey } from './i18n/translations';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

const ISSUE_URL = 'https://github.com/melisakumral/Sentinel/issues/new';

// English fallback used only if this ever renders outside a LanguageProvider
// (shouldn't happen given main.tsx's wiring, but a crash screen must never
// itself be able to crash on a missing context).
const FALLBACK_EN: Record<'ebTitle' | 'ebBody' | 'ebReload' | 'ebReport', string> = {
  ebTitle: 'Something went wrong',
  ebBody: 'Sentinel hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know.',
  ebReload: 'Reload',
  ebReport: 'Report issue',
};

// Top-level crash net: React error boundaries only work as class components
// (no hook equivalent), so language comes via the legacy `contextType` API
// instead of useLanguage(). Network/RPC failures are already handled inline
// throughout the app (classifyError, try/catch); this catches the rest —
// render-time exceptions that would otherwise blank the screen.
export default class ErrorBoundary extends Component<Props, State> {
  static contextType = LanguageContext;
  declare context: ContextType<typeof LanguageContext>;

  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sentinel crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const t = (key: keyof typeof FALLBACK_EN): string =>
      this.context ? this.context.t(key as TranslationKey) : FALLBACK_EN[key];

    const params = new URLSearchParams({
      title: `Crash: ${error.message}`.slice(0, 120),
      body: `**Error**\n\`\`\`\n${error.stack ?? error.message}\n\`\`\`\n\n**URL**: ${location.href}`,
      labels: 'bug',
    });

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{t('ebTitle')}</h1>
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 20px' }}>{t('ebBody')}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('ebReload')}
            </button>
            <a
              href={`${ISSUE_URL}?${params.toString()}`}
              target="_blank"
              rel="noreferrer"
              style={{
                border: '1px solid #27272a',
                color: '#a1a1aa',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t('ebReport')}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
