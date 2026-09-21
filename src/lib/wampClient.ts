const API_BASE = import.meta.env.VITE_WAMP_API_URL || 'http://localhost/hopealive-api';

type Filter = { column: string; operator: string; value: unknown };

function token() { return localStorage.getItem('wamp_token'); }
function headers() { return { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }; }

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private operation = 'select';
  private values: any;
  private filters: Filter[] = [];
  private columns: string[] | undefined;
  private orderBy: any;
  private maxRows: number | undefined;
  private one = false;

  constructor(private table: string) {}
  select(columns = '*') { this.columns = columns === '*' ? undefined : columns.split(',').map(value => value.trim().split(' ')[0]); return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, operator: '=', value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, operator: '!=', value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, operator: '>', value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, operator: '>=', value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ column, operator: '<', value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ column, operator: '<=', value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, operator: value === null ? 'IS' : '=', value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending ?? false }; return this; }
  limit(value: number) { this.maxRows = value; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  insert(values: any) { this.operation = 'insert'; this.values = Array.isArray(values) ? values[0] : values; return this; }
  update(values: any) { this.operation = 'update'; this.values = values; return this; }
  delete() { this.operation = 'delete'; return this; }
  then<TResult1 = { data: any; error: any }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }
  private async execute() {
    try {
      const table = this.table === 'audit_log' ? 'audit_logs' : this.table;
      const values = this.values && table === 'audit_logs' ? {
        ...this.values,
        entity_type: this.values.entity_type || 'application',
        details: this.values.details || JSON.stringify({ result: this.values.result, device_info: this.values.device_info }),
      } : this.values;
      const response = await fetch(`${API_BASE}/data.php`, { method: 'POST', headers: headers(), body: JSON.stringify({ table, operation: this.operation, values, columns: this.columns, filters: this.filters, order: this.orderBy, limit: this.maxRows, single: this.one }) });
      const body = await response.json();
      if (!response.ok) return { data: null, error: new Error(body.error || 'Database request failed') };
      const data = table === 'audit_logs' && Array.isArray(body.data) ? body.data.map((row: any) => {
        let details: any = {};
        try { details = row.details ? JSON.parse(row.details) : {}; } catch { details = {}; }
        return { ...row, result: details.result || 'recorded', device_info: details.device_info || 'WAMP server' };
      }) : body.data;
      return { data, error: body.error ? new Error(body.error) : null };
    } catch (error) { return { data: null, error }; }
  }
}

export const wampSupabase = {
  auth: {
    async getSession() {
      const saved = localStorage.getItem('wamp_user');
      const user = saved ? JSON.parse(saved) : null;
      return { data: { session: user && token() ? { user } : null }, error: null };
    },
    async getUser() { const { data } = await this.getSession(); return { data: { user: data.session?.user ?? null }, error: null }; },
    async signOut() { const current = token(); if (current) await fetch(`${API_BASE}/logout.php`, { method: 'POST', headers: { Authorization: `Bearer ${current}` } }); localStorage.removeItem('wamp_token'); localStorage.removeItem('wamp_user'); return { error: null }; },
  },
  from(table: string) { return new QueryBuilder(table); },
  async rpc(name: string, params?: any) {
    try {
      const response = await fetch(`${API_BASE}/rpc.php`, { method: 'POST', headers: headers(), body: JSON.stringify({ name, params }) });
      const body = await response.json();
      return { data: body.data ?? null, error: response.ok && !body.error ? null : new Error(body.error || 'Operation failed') };
    } catch (error) { return { data: null, error }; }
  },
  channel(_name: string) {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  },
  removeChannel(_channel: unknown) { return Promise.resolve(); },
};
