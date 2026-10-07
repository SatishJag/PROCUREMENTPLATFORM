import { useQuery } from '@tanstack/react-query';
import { call, getUser } from '../../api';
import { USERS } from '../../ui/AppShell';
import type { Tone } from '../../ui/StatusChip';

// Shapes of what `payables.*` returns (Procurement_core modules/payables.ts). Nothing is computed here: figures are the engine's.
export type Calc = { gross: number; retention: number; advanceRecovery: number; deductions: number; netBeforeTax: number; vat: number; wht: number; netPayable: number };
export type IpcRow = { id: string; ipcRef: string; version: number; contractId: string; projectId: string; supplierId: string; periodFrom: string; periodTo: string; status: string; errors: string[]; calc?: Calc; invoiceId?: string; stagedAt: string; certifiedBy: string };
export type Ipc = IpcRow & {
  lines: { boqItem: string; wbs: string; costCode: string; description: string; uom: string; prevQty: number; currQty: number; rate: number }[];
  variations: { ref: string; amount: number }[];
  adjustments: { materialOnSite?: number; retention?: number; advanceRecovery?: number; otherDeductions?: { type: string; amount: number }[] };
  attachments: { type: string; name: string }[]; taxInvoiceNo?: string;
};
export type IpcFeedback = { ipcId: string; status: string; errors: string[]; invoiceId?: string; invoiceStatus?: string };
export type Hold = { reason: string; ownerId: string; placedBy: string; placedOn: string; releaseCondition: string; releaseAuthority: string; releasedBy?: string; releasedOn?: string; releaseComment?: string };
export type Invoice = { id: string; ipcId: string; contractId: string; projectId: string; supplierId: string; taxInvoiceNo?: string; invoiceDate: string; calc: Calc; status: string; preparedBy: string; certifiedBy: string; approvedBy?: string; approvalComment?: string; rejectedReason?: string; holds: Hold[]; journalId?: string };
export type Journal = { id: string; invoiceId: string; ipcId: string; contractId: string; projectId: string; date: string; lines: { account: string; name: string; dr: number; cr: number }[]; status: string; batchId?: string };
export type Terms = { retentionPct: number; retentionCap: number; advanceAmount: number; advanceRecoveryPct: number; vatPct: number; whtPct: number; revisedValue: number; certified: number; retained: number; advanceRecovered: number };
export type Position = { revisedValue: number; cumulativeCertified: number; pendingCertified: number; remainingCommitment: number; retentionBalance: number; advanceBalance: number };
export type ContractRow = { id: string; supplierId: string; supplierName: string | null; projectId: string; value: number; terms: Terms | null; position: Position | null };
export type Batch = { batchId: string | null; count: number; csv: string };

export const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
/** People come from the shell's sample user list (no users endpoint for names). */
export const who = (id?: string) => USERS.find(u => u[0] === id)?.[1] ?? id ?? 'Unknown';
export const role = (id?: string) => USERS.find(u => u[0] === id)?.[2];
export const bad = (e: unknown) => (e as Error).message;

export const ipcTone: Record<string, Tone> = { validated: 'success', validation_failed: 'danger', invoiced: 'warning', accounted: 'success', rejected: 'danger', withdrawn: 'neutral', staged: 'neutral' };
export const invTone: Record<string, Tone> = { approval_required: 'warning', approved: 'success', accounted: 'success', on_hold: 'danger', rejected: 'danger' };
export const invLabel: Record<string, string> = { approval_required: 'Awaiting approval', on_hold: 'On hold' };
export const period = (r: { periodFrom: string; periodTo: string }) => `${r.periodFrom} to ${r.periodTo}`;

const q = <T,>(command: string, ...args: unknown[]) => ({ queryKey: ['payables', getUser(), command, ...args], queryFn: () => call<T>('payables', command, ...args) });
export const useIpcs = () => useQuery(q<IpcRow[]>('listIpcs'));
export const useInvoices = () => useQuery(q<Invoice[]>('list'));
export const useJournals = () => useQuery(q<Journal[]>('listJournals'));
export const useContracts = () => useQuery(q<ContractRow[]>('listContracts'));
export const useIpc = (id: string) => useQuery(q<Ipc>('getIpc', id));
export const useFeedback = (id: string) => useQuery(q<IpcFeedback>('ipcStatus', id));
export const people = () => ({ queryKey: ['people', getUser()], queryFn: () => call<{ id: string; name: string; roles: string[] }[]>('reporting', 'people') });
/** The buttons the engine says this user may press on an invoice now (role and state only: limits and segregation come back when pressed). */
export const actionsKey = (id: string) => ['actions', getUser(), 'payables', id];
export const actionsQuery = (id: string) => ({ queryKey: actionsKey(id), queryFn: () => call<string[]>('payables', 'actions', id) });

/** Save text as a file through a Blob (the engine returns the CSV, nothing is written server-side). */
export function download(name: string, csv: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
