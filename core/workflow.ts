import type { Role, User } from './types.ts';

// Table-driven state machines. Each module declares its own Flow table (stages,
// transitions, allowed roles) so an administrator edits data, not code.
export type Flow = Record<string, Record<string, { to: string; roles: Role[] }>>;

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
