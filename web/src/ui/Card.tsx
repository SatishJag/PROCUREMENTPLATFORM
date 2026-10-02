import type { CSSProperties, HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLElement> & { i?: number; lift?: boolean; as?: 'section' | 'div' | 'li' };

/** White rounded surface. `i` staggers the entrance; `lift` raises it on hover. */
export function Card({ i = 0, lift, as: Tag = 'section', className = '', style, ...rest }: Props) {
  return (
    <Tag
      {...rest}
      style={{ '--i': i, ...style } as CSSProperties}
      className={`rise rounded-card border border-line bg-card p-5 shadow-e1 ${lift ? 'lift' : ''} ${className}`}
    />
  );
}
