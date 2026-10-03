import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BoqTemplate, Package } from '@satishjag/procurement-core/types';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { control, Field, Input } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Check, Select } from '../../ui/bits';
import type { Budget } from './model';

const SAMPLE = 'lot,item,qty,unit,id\nA,2.5 MW diesel generator,4,nr,G1\nA,Fuel day tank,4,nr,G2\nB,Power cabling,1200,m,C1';
const ROUTES: [string, string][] = ['Direct PO', 'RFQ', 'RFP', 'ITT'].map(r => [r, r]); // ponytail: mirrors the engine's Route type; read it from the engine if the bands become configurable

/** Buyers and procurement managers: paste a BOQ as CSV, then cut it into a package. Roles, CSV rules and budget checks are the engine's; its errors show as returned. */
export function Boq({ budgets, projectId }: { budgets: Budget[]; projectId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [csv, setCsv] = useState('');
  const [pkg, setPkg] = useState({ costCode: '', category: '', estimate: '', needBy: '', route: 'RFP', longLead: false });
  const up = useMutation({ mutationFn: () => call<BoqTemplate>('intake', 'uploadBoq', { projectId, name: name.trim(), csvText: csv }), onSuccess: () => qc.invalidateQueries() });
  const mk = useMutation({
    mutationFn: () => call<Package>('intake', 'createPackagesFromBoq', { boqTemplateId: up.data!.id, ...pkg, estimate: Number(pkg.estimate.replace(/,/g, '')) }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const set = (k: keyof typeof pkg) => (v: string | boolean) => setPkg({ ...pkg, [k]: v });
  const boq = up.data;
  return (
    <Card i={3}>
      <Section title="Bill of quantities" meta="Buyers and procurement managers">
        <div className="grid gap-5 pt-3 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <Field label="BOQ name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hall 1 standby power" /></Field>
            <Field label="Lines as CSV" hint="Columns: lot, item, qty, unit, id. One line per row.">
              <textarea rows={6} value={csv} onChange={e => setCsv(e.target.value)} className={`${control} font-code text-label`} placeholder={SAMPLE} spellCheck={false} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" loading={up.isPending} onClick={() => up.mutate()}>Upload BOQ</Button>
              <button type="button" onClick={() => { setCsv(SAMPLE); setName(n => n || 'Hall 1 standby power'); }} className="soft min-h-11 px-1 underline underline-offset-4 hover:text-(--fg) md:min-h-0">Use sample lines</button>
            </div>
            {up.error && <p role="alert" className="font-medium text-danger">{up.error.message}</p>}
          </div>
          <div className="grid content-start gap-4">
            {!boq && <p className="soft">After the upload, the engine returns the lines and lots. Then create the package from them.</p>}
            {boq && (
              <div className="enter grid gap-3">
                <div className="flex flex-wrap items-center gap-2"><StatusChip tone="success">BOQ uploaded</StatusChip><span className="font-code text-label">{boq.id}</span><span className="soft">{boq.lines.length} lines, {boq.lots.length} lots</span></div>
                <ul className="divide-y divide-(--hair) rounded-ctl border border-(--hair)">
                  {boq.lines.map(l => <li key={l.id} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-3 px-3 py-2"><span className="font-code text-label">{l.id}</span><span>{l.item} <span className="soft">lot {l.lotId}</span></span><span className="numeral font-medium">{l.qty.toLocaleString('en')} {l.unit}</span></li>)}
                </ul>
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <Select label="Cost code" value={pkg.costCode} onChange={set('costCode')} placeholder="Choose" options={budgets.filter(b => b.project === boq.projectId).map(b => [b.costCode, b.costCode])} />
                  <Field label="Category"><Input value={pkg.category} onChange={e => set('category')(e.target.value)} placeholder="Electrical / Generators" /></Field>
                  <Field label="Estimate (AED)" hint={Number(pkg.estimate.replace(/,/g, '')) > 0 ? undefined : 'Package value'}><Input inputMode="decimal" value={pkg.estimate} onChange={e => set('estimate')(e.target.value)} /></Field>
                  <Field label="Need-by date"><Input type="date" value={pkg.needBy} onChange={e => set('needBy')(e.target.value)} className="[color-scheme:light]" /></Field>
                  <Select label="Route" value={pkg.route} onChange={set('route')} options={ROUTES} />
                  <Check label="Long lead" checked={pkg.longLead} onChange={set('longLead')} />
                </div>
                <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" loading={mk.isPending} onClick={() => mk.mutate()}>Create package</Button></div>
                {mk.error && <p role="alert" className="font-medium text-danger">{mk.error.message}</p>}
                {mk.data && <p role="status" className="flex flex-wrap items-center gap-2"><StatusChip tone="success">Package created</StatusChip><span className="font-code text-label">{mk.data.id}</span><Money value={mk.data.estimate} /><a href="#/sourcing" className="underline underline-offset-4">Open in Sourcing</a></p>}
              </div>
            )}
          </div>
        </div>
      </Section>
    </Card>
  );
}
