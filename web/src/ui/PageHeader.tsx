import type { ReactNode } from 'react';

type Figure = { label: string; value: ReactNode; big?: boolean };
type Props = {
  title: string;
  chip?: ReactNode;
  figures?: Figure[];
  /** The one primary action (or an ActionBar). Sits top right on desktop, full width under the figures on mobile. */
  action?: ReactNode;
  /** Optional layered visual, shown from lg. Content below the header overlaps its bottom edge. */
  visual?: ReactNode;
};

/** Title, status, key figures and the primary action, all above the fold. The deciding number is the `big` figure. */
export function PageHeader({ title, chip, figures = [], action, visual }: Props) {
  return (
    <header className="on-dark rise relative isolate rounded-hero bg-hero px-5 pb-20 pt-6 text-white shadow-e3 md:px-10 md:pb-24 md:pt-8 lg:min-h-[26rem]">
      {/* Gradient and glow layers, clipped to the rounded edge so the visual may overhang. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-hero" style={{ background: 'radial-gradient(40rem 22rem at 100% 0%, rgb(107 114 214 / 0.55), transparent 65%), radial-gradient(28rem 16rem at 0% 110%, rgb(245 184 0 / 0.16), transparent 70%), linear-gradient(135deg, #2d2a7a, #1b1858 70%)' }} />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="grid gap-3">
          <h1 className="text-title font-bold tracking-tight">{title}</h1>
          {chip && <div className="flex flex-wrap gap-2">{chip}</div>}
        </div>
        {action && <div className="max-md:[&>*]:w-full md:shrink-0">{action}</div>}
      </div>
      <dl className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 lg:max-w-[calc(100%-30rem)]">
        {figures.map(f => (
          <div key={f.label} className={f.big ? 'w-full' : ''}>
            <dt className="text-on-hero-soft">{f.label}</dt>
            <dd className={f.big ? 'text-[2rem] font-bold leading-none md:text-display' : 'text-section font-semibold'}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {visual && <div className="absolute right-10 top-24 hidden w-[27rem] lg:block">{visual}</div>}
    </header>
  );
}
