import type { ReactNode } from 'react';

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; align?: 'right'; mono?: boolean };

/** Dense table in Plex Condensed, tabular figures. `maxHeight` makes the header sticky inside a scrolling frame. */
export function Table<T>({ caption, columns, rows, rowKey, maxHeight }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; maxHeight?: string }) {
  return (
    <div tabIndex={0} role="region" aria-label={caption} className="overflow-auto rounded-ctl border border-(--hair)" style={{ maxHeight }}>
      <table className="w-full min-w-[54rem] border-collapse font-dense text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{columns.map(c => <th key={c.key} scope="col" className={`eyebrow sticky top-0 z-10 whitespace-nowrap border-b border-(--hair) bg-(--head) px-3 py-2.5 text-left font-semibold ${c.align === 'right' ? '!text-right' : ''}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className="border-b border-(--hair) last:border-0 hover:bg-(--sec-hover)/60">
              {columns.map(c => <td key={c.key} className={`px-3 py-2.5 align-top ${c.align === 'right' ? 'text-right' : ''} ${c.mono ? 'font-code text-label' : ''}`}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
