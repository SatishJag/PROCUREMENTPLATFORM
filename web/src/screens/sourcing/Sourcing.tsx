import { useState } from 'react';
import { Card } from '../../ui/Card';
import { eventsOf, useTwin } from './data';
import { Detail } from './Detail';
import { List } from './List';
import { SupplierPortal } from './Portal';
import { Wizard } from './Wizard';

type View = { k: 'list' } | { k: 'event'; id: string } | { k: 'new'; pkg?: string };

/** Staff read the enterprise twin (events, packages, invitations); anyone the twin refuses gets the supplier desk, which shows the engine's reason if there is nothing to bid on. */
export function Sourcing() {
  const twin = useTwin();
  const [view, setView] = useState<View>({ k: 'list' });
  if (twin.isPending) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-(--hair)" />;
  if (!twin.data) return <SupplierPortal reason={(twin.error as Error).message} />;
  const back = () => setView({ k: 'list' });
  if (view.k === 'new') return <Wizard twin={twin.data} pkgId={view.pkg} onBack={back} onDone={id => setView({ k: 'event', id })} />;
  if (view.k === 'event') {
    const ev = eventsOf(twin.data).find(e => e.id === view.id);
    if (ev) return <Detail ev={ev} twin={twin.data} onBack={back} />;
    return <Card glass className="soft" role="status">Loading the event from the engine…</Card>;
  }
  return <List twin={twin.data} onOpen={id => setView({ k: 'event', id })} onCreate={pkg => setView({ k: 'new', pkg })} />;
}
