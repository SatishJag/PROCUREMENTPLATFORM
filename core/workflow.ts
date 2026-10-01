import type { Role, User } from './types.ts';

// Table-driven state machines: an administrator changes stages, transitions and
// who may trigger them by editing these tables, not the code that runs them.
export type Flow = Record<string, Record<string, { to: string; roles: Role[] }>>;

const approvers: Role[] = ['procurement_manager', 'budget_owner', 'legal', 'executive'];

export const flows = {
  requisition: {
    draft: { submit: { to: 'submitted', roles: ['requester', 'buyer'] } },
    submitted: {
      approve: { to: 'approved', roles: ['budget_owner'] },
      reject: { to: 'rejected', roles: ['budget_owner'] },
    },
  },
  event: {
    draft: { publish: { to: 'open', roles: ['buyer'] } },
    open: {
      extend: { to: 'open', roles: ['buyer'] },
      close: { to: 'closed', roles: ['buyer'] },
    },
    closed: { open_technical: { to: 'technical', roles: ['buyer', 'procurement_manager'] } },
    technical: { complete_technical: { to: 'commercial', roles: ['procurement_manager'] } },
    commercial: { recommend: { to: 'approval', roles: ['buyer', 'procurement_manager'] } },
    approval: {
      award: { to: 'awarded', roles: approvers },
      reject: { to: 'commercial', roles: approvers },
    },
  },
  supplier: {
    invited: { register: { to: 'registered', roles: ['supplier'] } },
    registered: {
      qualify: { to: 'qualified', roles: ['procurement_manager'] },
      reject: { to: 'rejected', roles: ['procurement_manager'] },
    },
    qualified: { suspend: { to: 'suspended', roles: ['procurement_manager'] } },
    suspended: { reinstate: { to: 'qualified', roles: ['procurement_manager'] } },
  },
} satisfies Record<string, Flow>;

export function next(flow: Flow, state: string, action: string, user: User): string {
  const t = flow[state]?.[action];
  if (!t) throw new Error(`Cannot "${action}" while ${state}`);
  guard(user, t.roles);
  return t.to;
}

// Role + attribute check: role, project scope and transaction value.
export function guard(user: User, roles: Role[], ctx: { projectId?: string; value?: number } = {}) {
  if (!roles.some(r => user.roles.includes(r))) throw new Error(`${user.name} needs one of: ${roles.join(', ')}`);
  if (ctx.projectId && !user.projects.includes('*') && !user.projects.includes(ctx.projectId)) {
    throw new Error(`${user.name} has no access to project ${ctx.projectId}`);
  }
  if (ctx.value !== undefined && (user.approvalLimit ?? 0) < ctx.value) {
    throw new Error(`${user.name}'s authority limit is below ${ctx.value}`);
  }
}
