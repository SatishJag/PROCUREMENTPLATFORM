import type { ReactNode } from 'react';

type Figure = { label: string; value: ReactNode; big?: boolean };
type Props = {
  /** Small gold line above the title, e.g. the project. */
  eyebrow?: string;
  title: string;
  chip?: ReactNode;
  figures?: Figure[];
  /** The one primary action (or an ActionBar). Top right on desktop; render it with `sticky` so it docks to the bottom on mobile. */
  action?: ReactNode;
  /** Optional layered visual, shown from lg beside the figures. */
  visual?: ReactNode;
};

/** Title, status, key figures and the primary action, all above the fold, directly on the midnight stage. The deciding number is the `big` figure. */
export function PageHeader({ eyebrow, title, chip, figures = [], action, visual }: Props) {
  const big = figures.find(f => f.big);
  const rest = figures.filter(f => !f.big);
  return (
    <header className="rise grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 lg:grid-cols-[1fr_28rem]">
      <div className="grid content-start gap-2">
        {eyebrow && <p className="eyebrow !text-(--gold)">{eyebrow}</p>}
        <h1 className="text-title font-light tracking-[-0.01em]">{title}</h1>
        {chip && <div className="flex flex-wrap gap-2 pt-1">{chip}</div>}
      </div>
      {action && <div className="lg:justify-self-end lg:pt-5">{action}</div>}
      <div className="grid content-start gap-5 lg:row-start-2">
        {big && (
          <div>
            <p className="eyebrow">{big.label}</p>
            <p className="numeral mt-1 text-[2.75rem] leading-none md:text-display">{big.value}</p>
          </div>
        )}
        <div className="gold-rule" />
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {rest.map(f => (
            <div key={f.label}>
              <dt className="eyebrow">{f.label}</dt>
              <dd className="numeral mt-1 text-[1.5rem] leading-none">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {visual && <div className="hidden lg:row-start-2 lg:block lg:-mt-6">{visual}</div>}
    </header>
  );
}
