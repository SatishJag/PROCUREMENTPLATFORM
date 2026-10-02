import { useEffect, useState } from 'react';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Eases 0 to value once on mount and on change; renders the final value at once under reduced motion. */
function useCountUp(value: number, animate?: boolean) {
  const [x, setX] = useState(animate && !reduced() ? 0 : value);
  useEffect(() => {
    if (!animate || reduced()) return setX(value);
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.min((now - t0) / 1400, 1);
      setX(value * (1 - (1 - k) ** 4));
      if (k < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);
  return x;
}

type Props = { value: number; animate?: boolean; className?: string; big?: boolean };

/** AED, 2dp, tabular figures. The engine rounds per line; this only formats. `big` sets the decimals and currency small beside a display figure. */
export function Money({ value, animate, className = '', big }: Props) {
  const x = useCountUp(value, animate);
  const [whole, dec] = x.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className={big ? 'mr-2 align-baseline text-[0.3em] font-medium uppercase tracking-[0.14em] opacity-70' : 'opacity-70'}>{big ? 'AED' : 'AED '}</span>
      {whole}<span className={big ? 'text-[0.4em] opacity-60' : ''}>.{dec}</span>
    </span>
  );
}

export function Num({ value, animate, className = '' }: Omit<Props, 'big'>) {
  const x = useCountUp(value, animate);
  return <span className={className}>{Math.round(x).toLocaleString('en')}</span>;
}
