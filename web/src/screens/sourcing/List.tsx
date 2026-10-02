import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useDesktop } from '../../ui/bits';
import { Money, Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { eventsOf, plannedPackages, type Twin } from './data';
import { EventCard, Lanes } from './parts';

export function List({ twin, onOpen, onCreate }: { twin: Twin; onOpen: (id: string) => void; onCreate: (pkg?: string) => void }) {
  const desktop = useDesktop();
  const events = eventsOf(twin), planned = plannedPackages(twin);
  const count = (s: string) => events.filter(e => e.status === s).length;
  const open = count('open'), draft = count('draft');
  return (
    <>
      <PageHeader
        eyebrow="Project DC1, sample data"
        title="Sourcing events"
        chip={<>
          <StatusChip tone={open ? 'success' : 'neutral'}>{open} open for bids</StatusChip>
          {draft > 0 && <StatusChip tone="neutral">{draft} in draft</StatusChip>}
          {planned.length > 0 && <StatusChip tone="warning">{planned.length} package{planned.length > 1 ? 's' : ''} ready to source</StatusChip>}
        </>}
        figures={[
          { label: 'Events in flight', big: true, value: <Num value={events.filter(e => e.status !== 'awarded').length} animate /> },
          { label: 'Ready to source', value: <Num value={planned.length} animate /> },
          { label: 'Awarded', value: <Num value={count('awarded')} animate /> },
        ]}
        action={
          <div className="flex flex-wrap items-center justify-end gap-3 bar-sticky">
            {!planned.length && <p className="soft min-w-0 flex-1 basis-full max-md:order-first md:order-last md:text-right">No planned package is waiting for an event.</p>}
            <Button variant="primary" disabled={!planned.length} onClick={() => onCreate()} className="max-md:flex-1">Create event</Button>
          </div>
        }
      />

      {desktop ? (
        <section aria-labelledby="map" className="grid gap-3">
          <h2 id="map" className="text-section font-semibold">Pipeline map</h2>
          <p className="soft -mt-2">Scroll to zoom, drag to pan. Zoom in on a card for its detail, or open it for the lifecycle.</p>
          <Lanes events={events} planned={planned} onOpen={onOpen} onCreate={onCreate} />
        </section>
      ) : (
        <div className="grid gap-4">
          <h2 className="text-section font-semibold">Events</h2>
          {events.map((e, i) => <EventCard key={e.id} ev={e} i={i} onOpen={() => onOpen(e.id)} />)}
          {!events.length && <Card className="soft">No sourcing event exists yet.</Card>}
          {planned.length > 0 && <h2 className="text-section font-semibold pt-2">Ready to source</h2>}
          {planned.map((p, i) => (
            <Card key={p.id} i={i + events.length} className="grid gap-3">
              <span className="font-code text-label">{p.id}</span>
              <span className="font-medium">{p.label}</span>
              <span className="soft flex gap-4"><span>{p.meta?.route}</span>{p.value !== undefined && <Money value={p.value} />}</span>
              <Button variant="secondary" onClick={() => onCreate(p.id)}>Create event</Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
