import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ProfileMenu.css';
import { IconLogout } from './icons';
import { useLanguage } from './i18n/useLanguage';

interface Props {
  pubKey: string;
  network?: string;
  isOwner?: boolean;
  onDisconnect: () => void;
  align?: 'left' | 'right';
}

const EXPLORER_ACCOUNT_URL = 'https://stellar.expert/explorer/testnet/account/';
const PANEL_WIDTH = 260;

// The account entry point every screen was missing a clear version of:
// a small trigger (avatar + short address) that expands into the full
// address, a copy action, an explorer link, and disconnect — usable from
// both the crowdfunding dashboard sidebar and the Watch topbar. The panel
// is portaled to <body> with a fixed position computed from the trigger's
// bounding rect, so it isn't clipped by a scrolling ancestor (e.g. the
// dashboard sidebar, which needs its own overflow-y for short viewports).
export default function ProfileMenu({ pubKey, network = 'Stellar Testnet', isOwner, onDisconnect, align = 'right' }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawLeft = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - PANEL_WIDTH - 8);
    setPanelPos({ top: rect.bottom + 8, left });
  }, [open, align]);

  useEffect(() => {
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

  const initials = pubKey.slice(1, 3).toUpperCase();
  const short = `${pubKey.slice(0, 6)}...${pubKey.slice(-6)}`;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(pubKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — non-fatal.
    }
  };

  return (
    <div className="pm-root">
      <button
        ref={triggerRef}
        className="pm-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="pm-avatar">{initials}</span>
        <span className="pm-trigger-address">{short}</span>
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            className="pm-panel"
            style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}
          >
            <div className="pm-panel-head">
              <span className="pm-avatar pm-avatar--lg">{initials}</span>
              <div>
                <div className="pm-panel-address">{short}</div>
                {isOwner && <span className="pm-owner-tag">{t('sideCampaignOwner')}</span>}
              </div>
            </div>

            <div className="pm-row">
              <span className="pm-row-label">{t('pmNetwork')}</span>
              <span className="pm-row-value">{network}</span>
            </div>

            <div className="pm-actions">
              <button className="pm-action-btn" onClick={copyAddress}>
                {copied ? t('pmCopied') : t('pmCopyAddress')}
              </button>
              <a
                className="pm-action-btn"
                href={`${EXPLORER_ACCOUNT_URL}${pubKey}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('pmViewExplorer')}
              </a>
            </div>

            <button className="pm-disconnect" onClick={onDisconnect}>
              <IconLogout size={14} />
              {t('pmDisconnect')}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
