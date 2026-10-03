import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, control } from '../../ui/Field';
import { Ic, Tags } from '../../ui/bits';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { blocker, lines, n2, type Blocker, type Crit, type Pack, type Results } from './lib';
import { Badge, Reason } from './parts';

type Cell = { v: string; c: string; sig?: string; err?: string; open?: boolean };
const sig = (c: Cell) => `${c.v}|${c.c.trim()}`;
const key = (ref: string, cid: string) => `${ref}|${cid}`;

/** Scoring and sign-off state, lifted so the page header can hold the primary action. Every call goes to the engine; its message is the reason. */
export function useScoring(id: string) {
  const qc = useQueryClient();
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [locked, setLocked] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [signing, setSigning] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [signErr, setSignErr] = useState('');

  const set = (ref: string, cid: string, patch: Partial<Cell>) => setCells(s => ({ ...s, [key(ref, cid)]: { ...{ v: '', c: '' }, ...s[key(ref, cid)], ...patch, err: undefined } }));
  const dirty = Object.values(cells).filter(c => c.v !== '' && c.sig !== sig(c)).length;

  async function save(pack: Pack) {
    setSaving(true); setSaveErr('');
    const next = { ...cells }, lock = { ...locked };
    outer: for (const b of pack.bidders) for (const c of pack.criteria) {
      const k = key(b.ref, c.id), cell = next[k];
      if (!cell || cell.v === '' || cell.sig === sig(cell) || lock[b.ref]) continue;
      try {
        await call('evaluation', 'score', id, b.ref, c.id, Number(cell.v), cell.c.trim() || undefined);
        next[k] = { ...cell, sig: sig(cell), err: undefined };
      } catch (e) {
        const m = (e as Error).message;
        next[k] = { ...cell, err: m };
        if (m.startsWith('Conflict declared')) lock[b.ref] = m;
        else { setSaveErr(m); break outer; }
      }
    }
    setCells(next); setLocked(lock); setSaving(false);
  }

  async function signOff() {
    setSigning(true); setSignErr('');
    try {
      await call('evaluation', 'completeTechnical', id);
      setBlockers(null);
      await qc.invalidateQueries();
    } catch (e) {
      const m = (e as Error).message, ls = lines(m);
      if (ls.length) setBlockers(ls.map(blocker)); else { setBlockers(null); setSignErr(m); }
    }
    setSigning(false);
  }
  return { cells, set, locked, dirty, saving, saveErr, save, signing, signOff, blockers, signErr };
}
export type Scoring = ReturnType<typeof useScoring>;

const input = `h-11 md:h-10 ${control}`;

function Pack({ pack, error }: { pack?: Pack; error?: string }) {
  if (error) return <Card glass i={1} className="flex items-start gap-4"><Ic n="lock" className="mt-0.5 size-6 text-(--gold)" /><div className="grid gap-1"><h2 className="text-section font-semibold">Technical envelope is closed to you</h2><Reason>{error}</Reason></div></Card>;
  if (!pack) return <div aria-busy className="h-40 animate-pulse rounded-hero bg-(--hair)" />;
  return (
    <section aria-label="Technical pack" className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-section font-semibold">Technical pack</h2>
        <p className="soft flex items-center gap-1.5"><Ic n="lock" className="size-3.5 text-(--gold)" />Bidder names and all prices stay sealed. Evaluators see aliases, deviations and exclusions.</p>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pack.bidders.map((b, i) => (
          <Card as="li" key={b.ref} i={i + 1} className="grid content-start gap-3">
            <div className="flex items-center gap-3"><Badge i={i} size="size-10" /><div className="grid"><span className="text-section font-semibold">{b.name}</span><span className="soft">Price envelope sealed</span></div></div>
            <div className="gold-rule" />
            <div className="grid gap-1"><span className="eyebrow">Deviations</span>{b.deviations.length ? <ul className="grid gap-1">{b.deviations.map(d => <li key={d} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--gold)" />{d}</li>)}</ul> : <span className="soft">None declared</span>}</div>
            <div className="grid gap-1"><span className="eyebrow">Exclusions</span>{b.exclusions.length ? <ul className="grid gap-1">{b.exclusions.map(d => <li key={d} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--gold)" />{d}</li>)}</ul> : <span className="soft">None declared</span>}</div>
          </Card>
        ))}
      </ul>
    </section>
  );
}

function Declaration({ id }: { id: string }) {
  const [refs, setRefs] = useState<string[]>([]);
  const [done, setDone] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setErr('');
    try { await call('evaluation', 'declareConflicts', id, refs); setDone(refs); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <Card i={2} className="grid content-start gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section font-semibold">Conflict of interest</h2>
        {done && <StatusChip tone={done.length ? 'warning' : 'success'}>{done.length ? `Declared ${done.length}` : 'No conflicts'}</StatusChip>}
      </div>
      <p className="soft">Declare before you score. Names are blind, so enter the supplier reference you hold a conflict with. The engine then blocks you from scoring that bidder.</p>
      <Tags label="Conflicted suppliers" values={refs} onChange={setRefs} hint="Leave empty to declare none." />
      {err && <Reason>{err}</Reason>}
      {done && <p className="soft">Recorded this session: {done.length ? <span className="font-code text-label text-(--fg)">{done.join(', ')}</span> : 'none'}. The engine does not return past declarations.</p>}
      <div><Button variant="secondary" loading={busy} onClick={run}>{refs.length ? 'Declare conflicts' : 'Declare no conflicts'}</Button></div>
    </Card>
  );
}

function Row({ c, bi, s, locked, bl }: { c: Crit; bi: Pack['bidders'][number]; s: Scoring; locked: boolean; bl?: Blocker }) {
  const cell = s.cells[key(bi.ref, c.id)] ?? { v: '', c: '' };
  const saved = cell.sig !== undefined && cell.sig === sig(cell);
  const uid = `s-${bi.ref.replace(/\W/g, '')}-${c.id}`;
  const evidence = cell.open || cell.c !== '' || !!bl || !!cell.err;
  const err = locked ? undefined : bl?.msg ?? cell.err;
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 ${bl ? '-mx-3 rounded-ctl bg-danger-soft/70 px-3' : ''}`}>
      <label htmlFor={uid} className="grid min-w-0 gap-0.5">
        <span className="font-medium">{c.name}</span>
        <span className="soft flex flex-wrap items-center gap-x-3">{c.gate ? 'Gate: pass or fail' : `Weight ${c.weight}%`}{saved && !err && <span className="flex items-center gap-1 text-(--ok)"><Ic n="check" className="size-3.5" />Saved</span>}</span>
      </label>
      {c.gate
        ? <select id={uid} value={cell.v} disabled={locked} onChange={e => s.set(bi.ref, c.id, { v: e.target.value })} className={`${input} !w-32`}><option value="">Select</option><option value="1">Pass</option><option value="0">Fail</option></select>
        : <input id={uid} type="number" inputMode="decimal" min={0} max={10} step={0.5} value={cell.v} disabled={locked} placeholder="0 to 10" onChange={e => s.set(bi.ref, c.id, { v: e.target.value })} className={`${input} !w-32 text-right`} />}
      {evidence
        ? <input aria-label={`Evidence for ${c.name}, ${bi.name}`} value={cell.c} disabled={locked} placeholder="Evidence or comment" onChange={e => s.set(bi.ref, c.id, { c: e.target.value })} className={`${input} col-span-2`} />
        : !locked && <button type="button" onClick={() => s.set(bi.ref, c.id, { open: true })} className="col-span-2 min-h-11 justify-self-start rounded-ctl px-1 text-(--sec) underline underline-offset-4 hover:bg-(--sec-hover) active:scale-[0.97] md:min-h-8">Add evidence</button>}
      {err && <p role="alert" className="col-span-2 flex items-start gap-1.5 font-medium text-(--bad)"><Ic n="err" className="mt-0.5 size-4" />{err}</p>}
    </li>
  );
}

function Grid({ pack, s }: { pack: Pack; s: Scoring }) {
  return (
    <section aria-label="Scoring grid" className="grid content-start gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-section font-semibold">Your scores</h2>
        <p className="soft">0 to 10 on weighted criteria, pass or fail on gates. Very high and very low scores need a written basis; the engine checks at sign-off.</p>
      </div>
      {s.saveErr && <Card glass className="!p-4"><Reason>{s.saveErr}</Reason></Card>}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        {pack.bidders.map((b, i) => {
          const lock = s.locked[b.ref];
          return (
            <Card as="li" key={b.ref} i={i + 3} className={`grid content-start ${lock ? 'opacity-95' : ''}`}>
              <div className="flex items-center gap-3 pb-1"><Badge i={i} size="size-9" /><h3 className="text-section font-semibold">{b.name}</h3>
                {lock && <span className="ml-auto"><StatusChip tone="danger">Conflict, locked</StatusChip></span>}
              </div>
              {lock && <p role="alert" className="flex items-start gap-2 pb-1 font-medium text-(--bad)"><Ic n="lock" className="mt-0.5 size-4" />{lock}</p>}
              <ul className="divide-y divide-(--hair)">
                {pack.criteria.map(c => <Row key={c.id} c={c} bi={b} s={s} locked={!!lock} bl={s.blockers?.find(x => x.bidder === b.ref && x.criterion === c.name)} />)}
              </ul>
            </Card>
          );
        })}
      </ul>
    </section>
  );
}

function Readiness({ pack, s, onModerate }: { pack: Pack; s: Scoring; onModerate: (b: Blocker) => void }) {
  const found = (ref: string, name: string) => s.blockers?.filter(x => x.bidder === ref && x.criterion === name) ?? [];
  const attempted = s.blockers !== null;
  return (
    <Card i={4} className="grid content-start gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section font-semibold">Sign-off readiness</h2>
        {attempted && <StatusChip tone="danger">{s.blockers!.length} blocking</StatusChip>}
      </div>
      {!attempted && !s.signErr && <p className="soft">The engine lists what blocks sign-off when Sign off technical is pressed. Quorum, evidence and consensus are checked there.</p>}
      {s.signErr && <Reason>{s.signErr}</Reason>}
      {attempted && (
        <>
          <div className="overflow-x-auto"><table className="w-full border-collapse font-dense">
            <caption className="sr-only">Blocking reasons by bidder and criterion</caption>
            <thead><tr><th className="eyebrow py-1 text-left font-medium">Bidder</th>{pack.criteria.map(c => <th key={c.id} scope="col" title={c.name} className="eyebrow py-1 text-center font-code">{c.id}</th>)}</tr></thead>
            <tbody>{pack.bidders.map((b, i) => (
              <tr key={b.ref} className="border-t border-(--hair)">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium"><span className="flex items-center gap-2"><Badge i={i} size="size-6" />{b.ref.replace('Bidder ', '')}</span></th>
                {pack.criteria.map(c => {
                  const f = found(b.ref, c.name)[0];
                  return <td key={c.id} className="py-1 text-center">{f
                    ? (f.kind === 'disagree'
                      ? <button type="button" onClick={() => onModerate(f)} aria-label={`${b.ref}, ${c.name}: ${f.msg}. Moderate`} title="Evaluators disagree: moderate" className="mx-auto grid size-8 place-items-center rounded-full bg-danger-soft text-(--bad) transition-transform hover:scale-110 active:scale-[0.97]"><Ic n="err" /></button>
                      : <span role="img" aria-label={`${b.ref}, ${c.name}: ${f.msg}`} title={f.msg} className="mx-auto grid size-8 place-items-center rounded-full bg-danger-soft text-(--bad)"><Ic n="err" /></span>)
                    : <span role="img" aria-label={`${b.ref}, ${c.name}: no blocker`} className="mx-auto grid size-8 place-items-center text-(--ok)"><Ic n="check" /></span>}</td>;
                })}
              </tr>))}
            </tbody>
          </table></div>
          <p className="soft">{pack.criteria.map(c => `${c.id} ${c.name}`).join(', ')}.</p>
          <Section title="Engine reasons, verbatim" meta={`${s.blockers!.length}`}>
            <ul className="grid gap-1.5">{s.blockers!.map(b => <li key={b.raw} className="flex gap-2"><Ic n="err" className="mt-1 size-3.5 text-(--bad)" />{b.raw}</li>)}</ul>
          </Section>
        </>
      )}
    </Card>
  );
}

function Moderation({ id, pack, draft, setDraft }: { id: string; pack: Pack; draft: { ref: string; cid: string; v: string; note: string }; setDraft: (d: { ref: string; cid: string; v: string; note: string }) => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      await call('evaluation', 'moderate', id, draft.ref, draft.cid, Number(draft.v), draft.note);
      const c = pack.criteria.find(x => x.id === draft.cid)?.name;
      setMsg({ ok: true, t: `Consensus recorded: ${draft.ref}, ${c}, ${n2(Number(draft.v))}. Press Sign off technical again to re-check.` });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  };
  return (
    <Card i={5} id="moderation" className="grid content-start gap-3 scroll-mt-6">
      <h2 className="text-section font-semibold">Consensus moderation</h2>
      <p className="soft">When evaluators disagree, the committee agrees one score. It replaces the median for that criterion and the note goes to the audit trail.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bidder"><select value={draft.ref} onChange={e => setDraft({ ...draft, ref: e.target.value })} className={input}>{pack.bidders.map(b => <option key={b.ref}>{b.ref}</option>)}</select></Field>
        <Field label="Score"><input type="number" min={0} max={10} step={0.5} value={draft.v} onChange={e => setDraft({ ...draft, v: e.target.value })} className={`${input} text-right`} /></Field>
      </div>
      <Field label="Criterion"><select value={draft.cid} onChange={e => setDraft({ ...draft, cid: e.target.value })} className={input}>{pack.criteria.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Note of the consensus reached"><textarea rows={2} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} className={control} /></Field>
      {msg && (msg.ok ? <p className="flex items-start gap-2 text-(--ok)"><Ic n="check" className="size-4 mt-0.5" />{msg.t}</p> : <Reason>{msg.t}</Reason>)}
      <div><Button variant="secondary" loading={busy} onClick={run}>Record consensus</Button></div>
    </Card>
  );
}

function Outcome({ r, pack, names }: { r: Results; pack?: Pack; names: (id: string) => string }) {
  const crit = pack?.criteria ?? Object.keys(r.technical[0]?.consensus ?? {}).map(id => ({ id, name: id, weight: 0 }));
  return (
    <Card i={6} className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4"><h2 className="text-section font-semibold">Technical outcome</h2><p className="soft">Signed off. Names are revealed with the commercial envelope.</p></div>
      <Table caption="Technical results by bidder" rowKey={t => t.supplierId} rows={r.technical}
        columns={[
          { key: 'b', header: 'Bidder', cell: t => { const i = r.technical.indexOf(t); return <span className="flex items-center gap-2"><Badge i={i} size="size-6" /><span className="font-medium">Bidder {String.fromCharCode(65 + i)}</span><span className="soft">{names(t.supplierId)}</span></span>; } },
          { key: 's', header: 'Score', align: 'right', cell: t => <span className="numeral text-section">{n2(t.score)}</span> },
          { key: 'q', header: 'Result', cell: t => <StatusChip tone={t.qualified ? 'success' : 'danger'}>{t.qualified ? 'Qualified' : !t.complete ? 'Incomplete' : !t.gatesPassed ? 'Failed a gate' : 'Below threshold'}</StatusChip> },
          ...crit.map(c => ({ key: c.id, header: c.id, align: 'right' as const, cell: (t: Results['technical'][number]) => <span title={c.name}>{t.consensus[c.id] ?? ''}</span> })),
        ]} />
    </Card>
  );
}

export function Technical({ id, pack, packError, s, results, names, chair }: { chair?: boolean; id: string; pack?: Pack; packError?: string; s: Scoring; results?: Results; names: (id: string) => string }) {
  const [draft, setDraft] = useState({ ref: '', cid: '', v: '', note: '' });
  const onModerate = (pk: Pack) => (b: Blocker) => {
    setDraft({ ref: b.bidder, cid: pk.criteria.find(x => x.name === b.criterion)?.id ?? '', v: '', note: '' });
    document.getElementById('moderation')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };
  const filled = pack && { ...draft, ref: draft.ref || pack.bidders[0]?.ref || '', cid: draft.cid || pack.criteria.find(c => !c.gate)?.id || '' };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <Pack pack={pack} error={packError} />
      {pack && filled && chair && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
            <Readiness pack={pack} s={s} onModerate={onModerate(pack)} />
            <Moderation id={id} pack={pack} draft={filled} setDraft={setDraft} />
          </div>
          <Card className="!py-2"><Section title="Committee scoring" meta="Your own declaration and scores, if you sit on the committee">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-3 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start"><Grid pack={pack} s={s} /><Declaration id={id} /></div>
          </Section></Card>
        </>
      )}
      {pack && filled && !chair && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <div className="max-lg:order-2"><Grid pack={pack} s={s} /></div>
          <div className="grid gap-6 max-lg:contents lg:content-start">
            <div className="max-lg:order-1"><Declaration id={id} /></div>
            <div className="max-lg:order-3"><Readiness pack={pack} s={s} onModerate={onModerate(pack)} /></div>
            <div className="max-lg:order-4"><Moderation id={id} pack={pack} draft={filled} setDraft={setDraft} /></div>
          </div>
        </div>
      )}
      {results && <Outcome r={results} pack={pack} names={names} />}
    </div>
  );
}
