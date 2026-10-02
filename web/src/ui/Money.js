import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Eases 0 to value once on mount and on change; renders the final value at once under reduced motion. */
function useCountUp(value, animate) {
    const [x, setX] = useState(animate && !reduced() ? 0 : value);
    useEffect(() => {
        if (!animate || reduced())
            return setX(value);
        const t0 = performance.now();
        let raf = requestAnimationFrame(function tick(now) {
            const k = Math.min((now - t0) / 900, 1);
            setX(value * (1 - (1 - k) ** 3));
            if (k < 1)
                raf = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(raf);
    }, [value, animate]);
    return x;
}
/** AED, 2dp, tabular figures. The engine rounds per line; this only formats. */
export function Money({ value, animate, className = '' }) {
    const x = useCountUp(value, animate);
    return (_jsxs("span", { className: `whitespace-nowrap ${className}`, children: [_jsx("span", { className: "opacity-70", children: "AED " }), x.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }));
}
export function Num({ value, animate, className = '' }) {
    const x = useCountUp(value, animate);
    return _jsx("span", { className: className, children: Math.round(x).toLocaleString('en') });
}
