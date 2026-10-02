import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, Input } from '../../ui/Field';
import { Section } from '../../ui/Section';
import { Check, Ic, Lbl, Select, Tags } from './bits';
import { DESIGNATIONS, GROUPS, KINDS, PEOPLE, ROLES, aed, type ApproverKind, type Stage, type Workflow } from './fixtures';
import { condText, limitOf, resolve, ruleName } from './logic';

const options = (k: ApproverKind): [string, string][] =>
  k === 'role' ? ROLES.map(r => [r.id, r.label]) : k === 'person' ? PEOPLE.map(p => [p.id, `${p.name}, ${p.designation}`]) : k === 'designation' ? DESIGNATIONS.map(d => [d, d]) : k === 'group' ? GROUPS.map(g => [g.id, g.label]) : [];

type Props = { wf: Workflow; s: Stage; canEdit: boolean; why: string; patch: (p: Partial<Stage>) => void; setRule: (ruleId: string, on: boolean) => void; move: (d: -1 | 1) => void; remove: (reason: string) => void };

/** The editing panel for one stage. Every control writes to the draft, so the canvas redraws as you type. */
export function Inspector({ wf, s, canEdit, why, patch, setRule, move, remove }: Props) {
  const i = wf.stages.indexOf(s), a = resolve(s.approver), route = wf.kind === 'route';
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  return (
    <Card as="div" className="grid gap-2 !p-4 md:!p-5" aria-label={`Stage: ${s.name}`}>
      <div>
        <p className="eyebrow !text-(--gold)">Stage {i + 1} of {wf.stages.length}</p>
        <h3 className="text-section font-semibold">{s.name || 'Unnamed stage'}</h3>
      </div>
      {!canEdit && <p className="flex items-center gap-2 rounded-ctl bg-primary-soft p-3 text-ink-soft"><Ic n="lock" />{why}</p>}
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-1 border-0 p-0">
        <Section title="Approver and authority" defaultOpen>
          <div className="grid gap-3 pb-2">
            <Field label="Stage name"><Input value={s.name} onChange={e => patch({ name: e.target.value })} /></Field>
            <Select label={route ? 'Prepared by' : 'Approver type'} value={s.approver.kind} onChange={v => patch({ approver: { kind: v as ApproverKind, value: v === 'line_manager' ? 'requester' : '' }, limit: null })} options={KINDS} />
            {s.approver.kind === 'line_manager'
              ? <p className="text-ink-soft">Resolved at run time from the requester's profile: <b className="font-semibold text-ink">Requester's line manager</b>.</p>
              : <Select label={KINDS.find(k => k[0] === s.approver.kind)![1]} value={s.approver.value} onChange={v => patch({ approver: { ...s.approver, value: v }, limit: null })} options={options(s.approver.kind)} placeholder="Choose..." error={a.label ? undefined : 'Required: a stage with no approver blocks publishing.'} />}
            {!route && (
              <>
                <Field label="Authority limit (AED)" hint={s.limit == null ? `From the approver: ${limitOf(s) == null ? 'none stated' : aed(limitOf(s)!)}. Type to override.` : 'Overridden for this stage. Clear to use the approver\'s own limit.'}>
                  <Input type="number" min={0} step={1000} inputMode="numeric" value={s.limit ?? ''} placeholder={limitOf(s) == null ? 'None' : String(limitOf(s))} onChange={e => patch({ limit: e.target.value === '' ? null : num(e.target.value) })} />
                </Field>
                <Check label="Run in parallel with the previous stage" checked={s.parallelWithPrev && i > 0} disabled={i === 0} onChange={v => patch({ parallelWithPrev: v })} hint={i === 0 ? 'The first stage cannot be parallel.' : undefined} />
                <Select label="Quorum" value={s.quorum} onChange={v => patch({ quorum: v as Stage['quorum'] })} options={[['any', 'Any one approver'], ['all', 'All approvers']]} hint="Applies to groups, designations and parallel stages." />
              </>
            )}
          </div>
        </Section>
        {!route && (
          <Section title="SLA and escalation" meta={s.slaHours ? `${s.slaHours}h` : 'No SLA'} defaultOpen>
            <div className="grid gap-3 pb-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <Field label="SLA (hours)"><Input type="number" min={0} inputMode="numeric" value={s.slaHours} onChange={e => patch({ slaHours: num(e.target.value) })} /></Field>
              <Field label="Escalate after (hours)"><Input type="number" min={0} inputMode="numeric" value={s.escalateAfter} disabled={!s.escalateTo} onChange={e => patch({ escalateAfter: num(e.target.value) })} /></Field>
              <div className="sm:col-span-2 md:col-span-1 xl:col-span-2"><Select label="Escalate to" value={s.escalateTo} onChange={v => patch({ escalateTo: v })} options={ROLES.map(r => [r.id, r.label])} placeholder="Nobody, notify the process owner" /></div>
            </div>
          </Section>
        )}
        {!route && (
          <Section title="Delegation and notices">
            <div className="grid gap-2 pb-2">
              <Select label="When the approver is out of office" value={s.delegateTo} onChange={v => patch({ delegateTo: v })} options={PEOPLE.filter(p => p.limit != null).map(p => [p.id, p.name])} placeholder="No delegate, escalate instead" hint="The delegate acts within their own authority limit." />
              <Check label="Send email" checked={s.email} onChange={v => patch({ email: v })} />
              <Check label="Send in-app notice" checked={s.inApp} onChange={v => patch({ inApp: v })} />
            </div>
          </Section>
        )}
        <Section title="Documents, fields and checks" meta={s.forms.length + s.fields.length + s.validations.length || undefined}>
          <div className="grid gap-4 pb-2">
            <Tags label="Required documents and forms" values={s.forms} onChange={forms => patch({ forms })} />
            <Tags label="Custom fields" values={s.fields} onChange={fields => patch({ fields })} />
            <Tags label="Validation rules" values={s.validations} onChange={validations => patch({ validations })} />
          </div>
        </Section>
        <Section title="Routed by these rules" meta={`${wf.rules.filter(r => r.chain.includes(s.id)).length} of ${wf.rules.length}`}>
          <div className="grid gap-0.5 pb-2">
            {wf.rules.map(r => <Check key={r.id} label={ruleName(wf, r)} hint={`${r.effect === 'set' ? 'Sets the route' : 'Adds tiers'}; when ${condText(r)}`} checked={r.chain.includes(s.id)} onChange={v => setRule(r.id, v)} />)}
          </div>
        </Section>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button onClick={() => move(-1)} disabled={i === 0}><Lbl n="up2">Move earlier</Lbl></Button>
          <Button onClick={() => move(1)} disabled={i === wf.stages.length - 1}><Lbl n="down2">Move later</Lbl></Button>
          <Button variant="destructive" onReason={remove} className="ml-auto">Remove stage</Button>
        </div>
      </fieldset>
    </Card>
  );
}
