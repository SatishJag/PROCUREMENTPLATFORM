import type { CSSProperties, HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLElement> & { i?: number; lift?: boolean; glass?: boolean; as?: 'section' | 'div' | 'li' };

/** Porcelain card (or `glass` on the stage) with a champagne top hairline. `i` staggers the entrance; `lift` raises it on hover. */
export function Card({ i = 0, lift, glass, as: Tag = 'section', className = '', style, ...rest }: Props) {
  return (
    <Tag
      {...rest}
      style={{ '--i': i, ...style } as CSSProperties}
      className={`rise p-5 md:p-6 ${glass ? 'glass on-dark' : 'card on-light'} ${lift ? 'lift' : ''} ${className}`}
    />
  );
}
