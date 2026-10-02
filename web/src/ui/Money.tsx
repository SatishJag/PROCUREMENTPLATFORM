import { useEffect, useState } from 'react';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Eases 0 to value once on mount and on change; renders the final value at once under reduced motion. */
function useCountUp(value: number, animate?: boolean) {
  const [x, setX] = useState(animate && !reduced() ? 0 : value);
  useEffect(() => {
    if (!animate || reduced()) return setX(value);
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.min((now - t0) / 900, 1);
      setX(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);
  return x;
}

type Props = { value: number; animate?: boolean; className?: string };

/** AED, 2dp, tabular figures. The engine rounds per line; this only formats. */
export function Money({ value, animate, className = '' }: Props) {
  const x = useCountUp(value, animate);
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="opacity-70">AED </span>
      {x.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function Num({ value, animate, className = '' }: Props) {
  const x = useCountUp(value, animate);
  return <span className={className}>{Math.round(x).toLocaleString('en')}</span>;
}
