import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './FeedbackButton.css';
import { IconMessage } from './icons';
import { useLanguage } from './i18n/useLanguage';

const ISSUE_URL = 'https://github.com/melisakumral/Sentinel/issues/new';
const PANEL_WIDTH = 280;

interface Props {
  align?: 'left' | 'right';
  /** 'up' opens the panel above the trigger instead of below — needed when
   * the trigger sits near the bottom of the viewport (the fixed corner FAB),
   * where opening downward pushes the panel off-screen entirely. */
  placement?: 'down' | 'up';
}

// Zero-account feedback collection (Level 4: "temel kullanıcı geri
// bildirimlerinin toplanması"): submitting opens a pre-filled GitHub issue on
// the project's already-public repo — no third-party form service, no new
// account for us to create, and the result is a real, persistent, publicly
// verifiable feedback record instead of an opaque inbox.
export default function FeedbackButton({ align = 'left', placement = 'down' }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawLeft = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - PANEL_WIDTH - 8);
    if (placement === 'up') {
      // Anchored from the viewport bottom so the panel grows upward,
      // regardless of how tall its content ends up being.
      setPanelPos({ bottom: window.innerHeight - rect.top + 8, left });
    } else {
      setPanelPos({ top: rect.bottom + 8, left });
    }
  }, [open, align, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({
      title: `Feedback: ${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}`,
      body: `${trimmed}\n\n---\n_Submitted from the in-app feedback form._`,
      labels: 'feedback',
    });
    window.open(`${ISSUE_URL}?${params.toString()}`, '_blank', 'noreferrer');
    setText('');
    setOpen(false);
  };

  return (
    <div className="fb-root">
      <button ref={triggerRef} className="fb-trigger" onClick={() => setOpen((o) => !o)}>
        <IconMessage size={14} />
        {t('fbTrigger')}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            className="fb-panel"
            style={{ position: 'fixed', top: panelPos.top, bottom: panelPos.bottom, left: panelPos.left }}
          >
            <div className="fb-panel-title">{t('fbTitle')}</div>
            <p className="fb-panel-hint">{t('fbHint')}</p>
            <textarea
              className="fb-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('fbPlaceholder')}
              rows={4}
              autoFocus
            />
            <div className="fb-actions">
              <button className="fb-cancel" onClick={() => setOpen(false)}>
                {t('fbCancel')}
              </button>
              <button className="fb-submit" onClick={submit} disabled={!text.trim()}>
                {t('fbSubmit')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
