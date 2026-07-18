import { useId } from 'react';

// The Sentinel brand mark: a neon cyan cyber-shield with a radar/network
// node at its center — reused at any size across the connect gate, TopNav,
// and dashboard so every screen reads as one product.
export function SentinelLogo({ size = 20 }: { size?: number }) {
  const gid = useId();
  const fid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 500 500" fill="none" aria-hidden="true">
      <defs>
        <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#2962FF" />
        </linearGradient>
      </defs>

      <path
        d="M 250 80 L 380 130 L 380 270 C 380 370 280 430 250 440 C 220 430 120 370 120 270 L 120 130 Z"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={16}
        strokeLinejoin="round"
        filter={`url(#${fid})`}
      />

      <circle cx="250" cy="240" r="50" fill="none" stroke="#00E5FF" strokeWidth={6} opacity={0.8} />
      <circle cx="250" cy="240" r="18" fill="#00E5FF" filter={`url(#${fid})`} />

      <line x1="250" y1="130" x2="250" y2="190" stroke="#00E5FF" strokeWidth={4} opacity={0.6} />
      <line x1="250" y1="290" x2="250" y2="380" stroke="#00E5FF" strokeWidth={4} opacity={0.6} />
      <line x1="145" y1="240" x2="200" y2="240" stroke="#00E5FF" strokeWidth={4} opacity={0.6} />
      <line x1="300" y1="240" x2="355" y2="240" stroke="#00E5FF" strokeWidth={4} opacity={0.6} />
    </svg>
  );
}
