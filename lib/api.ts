export async function api<T = Record<string, unknown>>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(url, data === undefined ? {cache: 'no-store'} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'This request could not finish. Please retry.');
  return result as T;
}
