import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from 'react';

type View = { x: number; y: number; k: number };
type Props = {
  /** The canvas content, in its natural size. A function receives the live scale, so children can switch detail level (semantic zoom). */
  children: ReactNode | ((scale: number) => ReactNode);
  /** Accessible name, e.g. "Delivery timeline". Announced with the keyboard help. */
  label: string;
  min?: number;
  max?: number;
  /** Called whenever the scale changes (also on first fit). */
  onScale?: (scale: number) => void;
  className?: string;
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Pan and zoom canvas. Transform only (translate + scale on one layer).
 * Wheel and trackpad pinch (ctrl-wheel) zoom to the pointer; drag and two-finger pinch on touch; +, -, 0 and arrows when focused; visible buttons.
 * Plain wheel zooms, so place it where capturing the wheel is expected (a detail panel, a map), not inside a long scrolling column.
 */
export function Zoomable({ children, label, min = 0.25, max = 4, onScale, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View>({ x: 0, y: 0, k: 1 });
  const [glide, setGlide] = useState(false); // eased only for buttons and keys, never while dragging or wheeling
  const cur = useRef(v); cur.current = v;
  const clamp = (k: number) => Math.min(max, Math.max(min, k));

  const put = useCallback((n: View, ease = false) => { setGlide(ease && !reduced()); setV(n); }, []);
  const zoomAt = useCallback((cx: number, cy: number, f: number, ease = false) => {
    const { x, y, k } = cur.current; const k2 = Math.min(max, Math.max(min, k * f));
    put({ k: k2, x: cx - (cx - x) * (k2 / k), y: cy - (cy - y) * (k2 / k) }, ease);
  }, [max, min, put]);
  const centre = () => { const b = box.current!; return [b.clientWidth / 2, b.clientHeight / 2] as const; };
  const fit = useCallback(() => {
    const b = box.current, l = layer.current; if (!b || !l) return;
    const k = Math.min(max, Math.max(min, Math.min(b.clientWidth / l.offsetWidth, b.clientHeight / l.offsetHeight) * 0.96));
    put({ k, x: (b.clientWidth - l.offsetWidth * k) / 2, y: (b.clientHeight - l.offsetHeight * k) / 2 }, true);
  }, [max, min, put]);

  useEffect(() => { fit(); }, [fit]);
  useEffect(() => { onScale?.(v.k); }, [v.k, onScale]);

  // Wheel needs a non-passive listener to stop the page from scrolling under the canvas.
  useEffect(() => {
    const b = box.current!;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const r = b.getBoundingClientRect(), line = e.deltaMode === 1 ? 16 : 1;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * line * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    b.addEventListener('wheel', h, { passive: false });
    return () => b.removeEventListener('wheel', h);
  }, [zoomAt]);

  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const down = (e: PointerEvent) => { if ((e.target as HTMLElement).closest('button')) return; pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = false; };
  const move = (e: PointerEvent) => {
    const p = pts.current.get(e.pointerId); if (!p) return;
    const next = { x: e.clientX, y: e.clientY }, r = box.current!.getBoundingClientRect();
    if (pts.current.size === 2) {
      const other = [...pts.current].find(([id]) => id !== e.pointerId)![1];
      const f = dist(next, other) / (dist(p, other) || 1);
      zoomAt((next.x + other.x) / 2 - r.left, (next.y + other.y) / 2 - r.top, f);
    } else {
      if (!moved.current && Math.hypot(next.x - p.x, next.y - p.y) < 4) return;
      if (!moved.current) { moved.current = true; box.current!.setPointerCapture(e.pointerId); }
      put({ ...cur.current, x: cur.current.x + next.x - p.x, y: cur.current.y + next.y - p.y });
    }
    pts.current.set(e.pointerId, next);
  };
  const up = (e: PointerEvent) => { pts.current.delete(e.pointerId); };

  const key = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey) return;
    const [cx, cy] = centre(), step = 60, c = cur.current;
    const pan: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (e.key === '+' || e.key === '=') zoomAt(cx, cy, 1.25, true);
    else if (e.key === '-' || e.key === '_') zoomAt(cx, cy, 0.8, true);
    else if (e.key === '0') fit();
    else if (pan[e.key]) put({ ...c, x: c.x + pan[e.key][0], y: c.y + pan[e.key][1] }, true);
    else return;
    e.preventDefault();
  };

  const btn = 'grid size-11 place-items-center rounded-ctl text-(--fg) transition-transform duration-200 hover:bg-(--sec-hover) active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 md:size-10';
  return (
    <div
      ref={box}
      tabIndex={0}
      role="group"
      aria-roledescription="zoomable canvas"
      aria-label={`${label}. Plus and minus zoom, zero fits, arrow keys pan.`}
      onKeyDown={key}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={e => { if (moved.current) { e.stopPropagation(); moved.current = false; } }}
      className={`on-stage relative min-h-72 cursor-grab touch-none select-none overflow-hidden rounded-card border border-(--hair) bg-stage active:cursor-grabbing ${className}`}
    >
      <div ref={layer} className="absolute left-0 top-0 w-max origin-top-left" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`, transition: glide ? 'transform 0.4s cubic-bezier(0.16, 0.8, 0.2, 1)' : 'none' }}>
        {typeof children === 'function' ? children(v.k) : children}
      </div>
      <div className="glass absolute bottom-3 right-3 flex items-center gap-0.5 p-1" onPointerDown={e => e.stopPropagation()}>
        <button type="button" className={btn} aria-label="Zoom out" disabled={v.k <= min} onClick={() => zoomAt(...centre(), 0.8, true)}><svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
        <span role="status" aria-live="polite" className="w-12 text-center text-label font-medium">{Math.round(v.k * 100)}%</span>
        <button type="button" className={btn} aria-label="Zoom in" disabled={v.k >= max} onClick={() => zoomAt(...centre(), 1.25, true)}><svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
        <button type="button" className={`${btn} w-auto px-3 text-label font-medium`} aria-label="Fit to view" onClick={fit}>Fit</button>
      </div>
    </div>
  );
}
