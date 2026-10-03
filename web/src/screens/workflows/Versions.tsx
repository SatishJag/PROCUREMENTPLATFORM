import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, Input, control } from '../../ui/Field';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { DEMO_TODAY, type Entry, type LogItem } from './fixtures';
import type { Change, Issue } from './logic';

const mark = { added: ['success', 'Added'], removed: ['danger', 'Removed'], changed: ['neutral', 'Changed'] } as const;

export function Versions({ entry, changes, canEdit, why, log, discard, rollback }: {
  entry: Entry; changes: Change[]; canEdit: boolean; why: string; log: LogItem[];
  discard: (reason: string) => void; rollback: (v: number, reason: string) => void;
}) {
  const { published: pub, draft, history } = entry;
  return (
    <div className="grid gap-5">
      <Card as="div" className="grid gap-5" aria-label="Draft compared with published">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1 rounded-card border border-line bg-card p-4">
            <p className="eyebrow">Published</p>
            {pub ? <><p className="numeral text-[2rem] leading-none">v{pub.version}</p><p className="text-ink-soft">Effective {pub.effective}, owner {pub.owner}</p></> : <p className="text-ink-soft">Never published. This workflow is not live.</p>}
          </div>
          <div className={`grid gap-1 rounded-card border p-4 ${draft ? 'border-gold-deep/40 bg-warning-soft' : 'border-line bg-card'}`}>
            <p className="eyebrow">Draft</p>
            {draft ? <><p className="numeral text-[2rem] leading-none">v{draft.version}</p><p className="text-ink-soft">Edited {draft.edited} by {draft.editedBy}</p></> : <p className="text-ink-soft">No draft. Change a stage or a rule in the editor to start one.</p>}
          </div>
        </div>
        {draft && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="mr-auto text-section font-semibold">{changes.length} change{changes.length === 1 ? '' : 's'} in this draft</h3>
              {!canEdit && <span className="flex items-center gap-2 text-ink-soft"><Ic n="lock" />{why}</span>}
              <Button variant="destructive" disabled={!canEdit || !pub} onReason={discard}>Discard draft</Button>
            </div>
            {changes.length ? (
              <ul className="grid gap-2">
                {changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 border-b border-line pb-2 last:border-0">
                    <span className="w-24 shrink-0"><StatusChip tone={mark[c.kind][0]}>{mark[c.kind][1]}</StatusChip></span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-ink-soft">The draft is identical to the published version.</p>}
            <p className="text-ink-soft">Publish workflow, at the top, asks for the effective date and a reason.</p>
          </>
        )}
      </Card>
      <Card as="div" className="grid gap-3" aria-label="Version history">
        <h3 className="text-section font-semibold">Version history</h3>
        {history.length === 0 && <p className="text-ink-soft">No published versions yet.</p>}
        <ol className="grid gap-3">
          {history.map((h, i) => (
            <li key={h.v} className="grid gap-2 rounded-card border border-line bg-card p-4 md:grid-cols-[5rem_1fr_auto] md:items-center">
              <p className="numeral text-[1.75rem] leading-none">v{h.v}</p>
              <div><p className="font-medium">{h.reason}</p><p className="text-ink-soft">Effective {h.effective}. Published by {h.by} on {h.at}.</p></div>
              <div className="flex items-center gap-2">
                {i === 0 ? <StatusChip tone="success">Live</StatusChip> : h.snapshot
                  ? <Button variant="destructive" disabled={!canEdit} onReason={r => rollback(h.v, r)}>Roll back to v{h.v}</Button>
                  : <span className="text-ink-soft">Archived, not restorable in the demo</span>}
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card as="div" aria-label="Change log"><Section title="Change log" meta={`${log.length} entries`} defaultOpen>
        <ol className="grid gap-3 pt-1">
          {log.map((l, i) => (
            <li key={i} className="grid gap-0.5 border-b border-line pb-3 last:border-0 md:grid-cols-[9rem_1fr]">
              <p className="font-code text-label text-ink-soft">{l.at}</p>
              <div><p><b className="font-semibold">{l.who}</b> on {l.wf}: {l.text}.</p><p className="text-ink-soft">Why: {l.reason}</p></div>
            </li>
          ))}
        </ol>
      </Section></Card>
    </div>
  );
}

/** Publish: needs an effective date and a reason, and is blocked by errors. Updates local state only. */
export function PublishDialog({ open, onClose, name, version, errors, warnings, changes, publish }: {
  open: boolean; onClose: () => void; name: string; version: number; errors: Issue[]; warnings: number; changes: number; publish: (date: string, reason: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(''), [reason, setReason] = useState('');
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const block = errors.length ? `${errors.length} blocking error${errors.length > 1 ? 's' : ''}. Fix ${errors.length > 1 ? 'them' : 'it'} to publish.` : !date ? 'Choose an effective date.' : date < DEMO_TODAY ? 'The effective date cannot be in the past.' : reason.trim().length < 5 ? 'Give a reason for the change.' : '';
  return (
    <dialog ref={ref} aria-label={`Publish ${name}`} onClose={onClose} className="zoom-panel card on-light m-auto w-[min(34rem,calc(100vw-2rem))] p-6 shadow-e3">
      <form onSubmit={e => { e.preventDefault(); if (!block) { publish(date, reason.trim()); setDate(''); setReason(''); } }} className="grid gap-4">
        <div><p className="eyebrow !text-(--gold)">Local demo, nothing reaches the engine</p><h2 className="text-section font-semibold">Publish {name}, v{version}</h2></div>
        <p className="text-ink-soft">{changes} change{changes === 1 ? '' : 's'} since the published version{warnings ? `, ${warnings} item${warnings > 1 ? 's' : ''} to check` : ''}.</p>
        {errors.length > 0 && <ul role="alert" className="grid gap-1.5 rounded-ctl bg-danger-soft p-3 text-danger">{errors.map(e => <li key={e.text} className="flex gap-2"><Ic n="err" className="mt-0.5 size-4" />{e.text}</li>)}</ul>}
        <Field label="Effective date" hint="Requests already in flight finish on the version they started with."><Input type="date" min={DEMO_TODAY} required value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Reason for the change" hint="Recorded in the change log with your name."><textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} className={control} /></Field>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {block && <p className="min-w-0 flex-1 text-ink-soft max-sm:basis-full">{block}</p>}
          <Button variant="text" onClick={onClose}>Cancel</Button>
          <button type="submit" disabled={!!block} className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-ctl bg-primary px-5 font-semibold text-on-primary shadow-e1 transition-transform hover:bg-primary-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 md:h-10">Publish workflow</button>
        </div>
      </form>
    </dialog>
  );
}
