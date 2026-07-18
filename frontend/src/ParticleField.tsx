import { useEffect, useMemo, useRef } from 'react';

const COUNT = 46;
const HUES = ['cyan', 'blue', 'teal'] as const;

interface Particle {
  baseX: number;
  baseY: number;
  size: number;
  hue: (typeof HUES)[number];
  phase: number;
}

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    baseX: Math.random() * 100,
    baseY: Math.random() * 100,
    size: 2 + Math.random() * 3,
    hue: HUES[i % HUES.length],
    phase: Math.random() * Math.PI * 2,
  }));
}

// Ambient, full-viewport particle network mounted once behind every screen
// in .sentinel-app (ConnectGate, Dashboard, Explore, Profile) — idle-drifting
// nodes that lean toward the cursor wherever it is on the page. Fixed
// positioning + pointer-events: none, so it never blocks clicks and stays in
// place while page content scrolls underneath it. Sentinel Watch keeps its
// own separate terminal-log visual identity and doesn't mount this.
export default function ParticleField() {
  const particles = useMemo(() => makeParticles(COUNT), []);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const posRef = useRef(particles.map((p) => ({ x: p.baseX, y: p.baseY })));

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 };
    };
    const onLeave = () => {
      mouseRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      const mouse = mouseRef.current;
      particles.forEach((p, i) => {
        const idleX = p.baseX + Math.sin(elapsed * 0.4 + p.phase) * 1.6;
        const idleY = p.baseY + Math.cos(elapsed * 0.35 + p.phase) * 1.6;
        let targetX = idleX;
        let targetY = idleY;
        if (mouse) {
          const dx = mouse.x - idleX;
          const dy = mouse.y - idleY;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = Math.min(14, dist * 0.22) / dist;
          targetX = idleX + dx * pull;
          targetY = idleY + dy * pull;
        }
        const pos = posRef.current[i];
        pos.x += (targetX - pos.x) * 0.06;
        pos.y += (targetY - pos.y) * 0.06;
        const el = nodeRefs.current[i];
        if (el) {
          el.style.left = `${pos.x}%`;
          el.style.top = `${pos.y}%`;
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [particles]);

  return (
    <div className="sn-ambient-field" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className={`sn-ambient-particle sn-ambient-particle--${p.hue}`}
          style={{ width: p.size, height: p.size, left: `${p.baseX}%`, top: `${p.baseY}%` }}
        />
      ))}
    </div>
  );
}
