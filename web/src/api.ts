// The only way the browser talks to the engine. Domain logic stays in the engine.
// ponytail: x-user-id header stands in for Entra ID; swap with the session token.
let userId = localStorage.getItem('userId') ?? 'u-daniel';
export const getUser = () => userId;
export const setUser = (id: string) => { userId = id; localStorage.setItem('userId', id); };

export async function call<T = unknown>(module: string, command: string, ...args: unknown[]): Promise<T> {
  const res = await fetch(`/api/${module}/${command}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ args }),
  });
  const body = await res.json().catch(() => ({ ok: false, error: `Engine unreachable (${res.status})` }));
  if (!body.ok) throw new Error(body.error);
  return body.data as T;
}
