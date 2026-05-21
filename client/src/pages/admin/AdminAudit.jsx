import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Loader2, Filter } from 'lucide-react';
import { api } from '../../api/client.js';

// Phase 3.4 — Audit log viewer. Shows the tamper-evident chain of
// administrative actions (staff invites, role changes, etc.). Filter by
// action/resource/actor. Server scopes results per role automatically.
export default function AdminAudit() {
  const [filters, setFilters] = useState({ action: '', resource: '' });

  const query = useQuery({
    queryKey: ['admin-audit', filters],
    queryFn: () =>
      api.get('/admin/audit', {
        params: {
          action: filters.action || undefined,
          resource: filters.resource || undefined,
          limit: 100,
        },
      }).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            <ScrollText className="text-primary" size={22} /> Audit log
          </h1>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Tamper-evident record of administrative actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-neutral-500" />
          <input
            className="input !py-1.5 text-sm w-40"
            placeholder="action (e.g. staff.invite)"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          />
          <input
            className="input !py-1.5 text-sm w-32"
            placeholder="resource"
            value={filters.resource}
            onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
          />
        </div>
      </div>

      {query.isPending && (
        <div className="grid place-items-center py-12">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      )}
      {query.isError && <div className="card text-danger">Could not load audit log.</div>}
      {query.data?.audit === 'disabled' && (
        <div className="card">Audit log is disabled (set <code>AUDIT_ENABLED=true</code>).</div>
      )}
      {query.data && query.data.audit !== 'disabled' && (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Resource</th>
                <th className="p-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {query.data.entries.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-neutral-500">No entries match these filters.</td></tr>
              )}
              {query.data.entries.map((e) => (
                <tr key={e._id} className="border-t border-neutral-100 align-top">
                  <td className="p-3 text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-xs">{e.action}</td>
                  <td className="p-3 text-xs">
                    {e.actorId?.name || '—'}
                    {e.actorRole && <span className="text-neutral-400 ms-1">({e.actorRole})</span>}
                  </td>
                  <td className="p-3 text-xs">
                    {e.resource}
                    {e.resourceId && <span className="text-neutral-400 ms-1 font-mono">{String(e.resourceId).slice(-6)}</span>}
                  </td>
                  <td className="p-3 text-xs font-mono text-neutral-600 max-w-md truncate" title={JSON.stringify(e.metadata)}>
                    {e.metadata && Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
