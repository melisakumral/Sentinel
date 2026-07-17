import { useEffect, useMemo, useRef } from 'react';
import { IconActivity, IconCheckShield, IconLock } from './icons';
import { SentinelLogo } from './Logo';
import TopNav from './TopNav';
import { useLanguage } from './i18n/useLanguage';

interface Props {
  connecting: boolean;
  errorMessage: string;
  onConnect: () => void;
}

const PARTICLE_COUNT = 16;
const HUES = ['blue', 'indigo', 'teal'] as const;

interface Particle {
  baseX: number;
  baseY: number;
  size: number;
  hue: (typeof HUES)[number];
  phase: number;
}

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    baseX: 8 + Math.random() * 84,
    baseY: 8 + Math.random() * 84,
    size: 4 + Math.random() * 5,
    hue: HUES[i % HUES.length],
    phase: Math.random() * Math.PI * 2,
  }));
}

// A field of small orbs that idle-drift, lean toward the cursor as it moves
// across the pane, and pull in to the center while a connection is in
// progress — the "objects that follow the mouse" the security hero needed.
function ParticleField({ connecting }: { connecting: boolean }) {
  const particles = useMemo(() => makeParticles(PARTICLE_COUNT), []);
  const paneRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const posRef = useRef(particles.map((p) => ({ x: p.baseX, y: p.baseY })));
  const connectingRef = useRef(connecting);
  connectingRef.current = connecting;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      const mouse = mouseRef.current;
      const isConnecting = connectingRef.current;
      particles.forEach((p, i) => {
        const idleX = p.baseX + Math.sin(elapsed * 0.6 + p.phase) * 2.4;
        const idleY = p.baseY + Math.cos(elapsed * 0.5 + p.phase) * 2.4;
        let targetX = idleX;
        let targetY = idleY;
        if (isConnecting) {
          targetX = 50;
          targetY = 50;
        } else if (mouse) {
          const dx = mouse.x - idleX;
          const dy = mouse.y - idleY;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = Math.min(30, dist * 0.5) / dist;
          targetX = idleX + dx * pull;
          targetY = idleY + dy * pull;
        }
        const pos = posRef.current[i];
        pos.x += (targetX - pos.x) * 0.07;
        pos.y += (targetY - pos.y) * 0.07;
        const el = nodeRefs.current[i];
        if (el) {
          el.style.left = `${pos.x}%`;
          el.style.top = `${pos.y}%`;
          el.style.opacity = isConnecting ? '0' : '';
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [particles]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };
  const handleMouseLeave = () => {
    mouseRef.current = null;
  };

  return (
    <div ref={paneRef} className="sn-particle-field" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {particles.map((p, i) => (
        <span
          key={i}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className={`sn-particle sn-particle--${p.hue}`}
          style={{ width: p.size, height: p.size, left: `${p.baseX}%`, top: `${p.baseY}%` }}
        />
      ))}
    </div>
  );
}

const WALLET_BADGES = [
  { label: 'Freighter', initial: 'F', hue: 'indigo' },
  { label: 'Albedo', initial: 'A', hue: 'teal' },
  { label: 'xBull', initial: 'X', hue: 'blue' },
  { label: 'LOBSTR', initial: 'L', hue: 'indigo' },
] as const;

export default function ConnectGate({ connecting, errorMessage, onConnect }: Props) {
  const { t } = useLanguage();
  return (
    <div className="sn-gate-page">
      <TopNav active="home" />
      <div className="sn-gate">
      <div className="sn-gate-left">
        <div className="sn-gate-left-glow" aria-hidden="true" />
        <div className="sn-brand" style={{ marginBottom: 8 }}>
          <div className="sn-brand-mark">
            <SentinelLogo size={18} />
          </div>
          <div>
            <div className="sn-brand-name">{t('brandName')}</div>
            <div className="sn-brand-sub">{t('brandSub')}</div>
          </div>
        </div>
        <div className="sn-secured-caption">
          <IconCheckShield size={12} />
          {t('securedCaption')}
        </div>

        <h1 className="sn-gate-heading" style={{ marginTop: 28 }}>
          {t('connectHeading')}
        </h1>
        <p className="sn-gate-subtext">{t('connectSubtext')}</p>

        <button className="sn-btn sn-btn--primary sn-btn--block sn-btn--iconed" onClick={onConnect} disabled={connecting}>
          <IconLock size={15} />
          {connecting ? t('connectingButton') : t('connectButton')}
        </button>

        {errorMessage && <div className="sn-gate-error">{errorMessage}</div>}

        <div className="sn-wallet-badges">
          <span className="sn-wallet-badges-label">{t('worksWith')}</span>
          <div className="sn-wallet-badges-row">
            {WALLET_BADGES.map((w) => (
              <span key={w.label} className={`sn-wallet-badge sn-wallet-badge--${w.hue}`} title={w.label}>
                {w.initial}
              </span>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 22, lineHeight: 1.6 }}>{t('finePrint')}</p>
      </div>

      <div className={`sn-gate-right ${connecting ? 'sn-gate-connecting' : ''}`}>
        <div className="sn-orbit-wrap">
          <ParticleField connecting={connecting} />
          <div className="sn-radar-ring sn-radar-ring--1" />
          <div className="sn-radar-ring sn-radar-ring--2" />
          <div className="sn-radar-sweep" />
          <div className="sn-orbit-core">
            <SentinelLogo size={28} />
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 10px', textAlign: 'center' }}>
          {t('securityHeading')}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6, margin: '0 0 32px' }}>
          {t('securitySubtext')}
        </p>

        <ul className="sn-feature-list">
          <li className="sn-feature-item">
            <div className="sn-feature-icon sn-feature-icon--indigo">
              <IconLock size={16} />
            </div>
            <div>
              <p className="sn-feature-title">{t('featureNonCustodialTitle')}</p>
              <p className="sn-feature-body">{t('featureNonCustodialBody')}</p>
            </div>
          </li>
          <li className="sn-feature-item">
            <div className="sn-feature-icon sn-feature-icon--teal">
              <IconCheckShield size={16} />
            </div>
            <div>
              <p className="sn-feature-title">{t('featureVerifiableTitle')}</p>
              <p className="sn-feature-body">{t('featureVerifiableBody')}</p>
            </div>
          </li>
          <li className="sn-feature-item">
            <div className="sn-feature-icon sn-feature-icon--blue">
              <IconActivity size={16} />
            </div>
            <div>
              <p className="sn-feature-title">{t('featureMonitoringTitle')}</p>
              <p className="sn-feature-body">{t('featureMonitoringBody')}</p>
            </div>
          </li>
        </ul>
      </div>
      </div>
    </div>
  );
}
