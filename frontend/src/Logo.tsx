import { useId } from 'react';

// The Sentinel brand mark: a guardian shield with a watching eye at its
// center, gradient blue -> indigo. Reused at any size across the connect
// gate and the dashboard topbar so the two screens read as one product.
export function SentinelLogo({ size = 20 }: { size?: number }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M16 2l12 5v9c0 8-5.2 13-12 14-6.8-1-12-6-12-14V7l12-5z" fill={`url(#${gid})`} />
      <path
        d="M16 9.5c2.4 0 4.3 1.9 4.3 4.3 0 1.7-1 3.2-2.4 3.9l.9 4.3h-5.6l.9-4.3a4.3 4.3 0 0 1-2.4-3.9c0-2.4 1.9-4.3 4.3-4.3z"
        fill="#0b1220"
        opacity="0.85"
      />
      <circle cx="16" cy="13.8" r="1.6" fill="#e0f2fe" />
    </svg>
  );
}
