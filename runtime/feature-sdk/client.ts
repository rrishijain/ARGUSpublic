/* Fixed browser SDK. Generated code can request only the capabilities granted by its manifest. */
type Query = { filters?: Array<{ column: string; operator: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean }>; limit?: number; orderBy?: { column: string; direction: 'asc' | 'desc' }; aggregation?: 'count' | 'sum' | 'average' | 'latest'; column?: string };
type Row = Record<string, string | number | boolean | null>;
declare global { interface Window { __ARGUS_FEATURE_CHANNEL__: string } }
let sequence = 0;
const pending = new Map<string, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.channel !== window.__ARGUS_FEATURE_CHANNEL__ || event.data?.type !== 'argus:feature:result') return;
  const item = pending.get(event.data.id); if (!item) return;
  clearTimeout(item.timer); pending.delete(event.data.id);
  if (event.data.error) item.reject(new Error(event.data.error)); else item.resolve(event.data.result);
});
function request(method: string, args: unknown = {}): Promise<any> {
  if (pending.size >= 20) return Promise.reject(new Error('Too many outstanding requests.'));
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('ARGUS request timed out. Please try again.')); }, method==='reports.run'?120000:30000);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ type: 'argus:feature:request', channel: window.__ARGUS_FEATURE_CHANNEL__, id, method, args }, '*');
  });
}
export const argus = Object.freeze({
  records: Object.freeze({ list: (query: Query = {}) => request('records.list', query), create: (values: Row) => request('records.create', { values }), update: (id: string, values: Row) => request('records.update', { id, values }) }),
  sources: Object.freeze({ query: (sourceId: string, query: Query = {}) => request('sources.query', { sourceId, query }), text: (sourceId: string) => request('sources.text', { sourceId }) }),
  calculate: (rows: Row[], query: Query) => request('calculate', { rows, query }),
  ratio: (numerator: number, denominator: number) => request('ratio', { numerator, denominator }),
  tasks: Object.freeze({ list: () => request('tasks.list'), add: (title: string) => request('tasks.add', { title }), toggle: (id: string, done: boolean) => request('tasks.toggle', { id, done }) }),
  notes: Object.freeze({ list: () => request('notes.list'), add: (title: string, text: string) => request('notes.add', { title, text }) }),
  reports: Object.freeze({ run: (workflow: 'brief' | 'summarise' | 'ask' | 'draft' | 'plan', question: string) => request('reports.run', { workflow, question }) }),
});
