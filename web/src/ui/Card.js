import { jsx as _jsx } from "react/jsx-runtime";
/** White rounded surface. `i` staggers the entrance; `lift` raises it on hover. */
export function Card({ i = 0, lift, as: Tag = 'section', className = '', style, ...rest }) {
    return (_jsx(Tag, { ...rest, style: { '--i': i, ...style }, className: `rise rounded-card border border-line bg-card p-5 shadow-e1 ${lift ? 'lift' : ''} ${className}` }));
}
