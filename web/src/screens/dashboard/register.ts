import { useQuery } from '@tanstack/react-query';
import { call, getUser } from '../../api';

/** One row of the engine's package register (reporting.exportPackages, a CSV). Restricted by the engine to buyers, managers and auditors. */
export type Pkg = { id: string; title: string; category: string; route: string; estimate: number; awarded: number | null; status: string; longLead: boolean; needBy: string; next: string };

// RFC 4180 reader for the engine's CSV: BOM, CRLF and quoted commas.
function rows(text: string) {
  const out: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (const ch of text.replace(/^﻿/, '')) {
    if (q) { if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

export const parseRegister = (text: string): Pkg[] => {
  const [head, ...body] = rows(text), at = (r: string[], k: string) => r[head.indexOf(k)] ?? '';
  return body.map(r => ({ id: at(r, 'id'), title: at(r, 'title'), category: at(r, 'category'), route: at(r, 'route'), estimate: Number(at(r, 'estimate')), awarded: at(r, 'awarded') ? Number(at(r, 'awarded')) : null, status: at(r, 'status'), longLead: at(r, 'longLead') === 'yes', needBy: at(r, 'needBy'), next: at(r, 'next') }));
};

export const useRegister = () => useQuery({ queryKey: ['register', getUser()], queryFn: async () => parseRegister(await call<string>('reporting', 'exportPackages')) });
