import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';

// Phase 3.5 — Super-admin review queue for clinic onboarding applications.
// Lists pending + verified applications and lets the reviewer approve or
// reject. Approval creates the live Clinic + clinic_admin User; rejection
// records a free-text reason.
export default function AdminOnboarding() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['onboarding', statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/onboarding/applications?status=${statusFilter}` : '/onboarding/applications';
      const { data } = await api.get(url);
      return data;
    },
  });

  const approve = useMutation({
    mutationFn: (id) => api.post(`/onboarding/applications/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding'] }); push('Application approved.', 'success'); },
    onError: (e) => push(e?.response?.data?.error || 'Approval failed', 'error'),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/onboarding/applications/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding'] }); push('Application rejected.', 'success'); },
    onError: (e) => push(e?.response?.data?.error || 'Reject failed', 'error'),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">Clinic onboarding</h1>
          <p className="text-sm text-neutral-900/70">Review and approve self-service clinic applications.</p>
        </div>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending email verification</option>
          <option value="email_verified">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isPending && (
        <div className="card flex items-center gap-2 text-sm text-neutral-900/70">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isPending && items.length === 0 && (
        <div className="card text-sm text-neutral-900/70">No applications in this view.</div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {items.map((it) => (
          <Row
            key={it._id}
            it={it}
            busy={approve.isPending || reject.isPending}
            onApprove={() => approve.mutate(it._id)}
            onReject={(reason) => reject.mutate({ id: it._id, reason })}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ it, onApprove, onReject, busy }) {
  const [reason, setReason] = useState('');
  const canReview = it.status === 'email_verified';
  const statusColor = {
    pending: 'bg-amber-100 text-amber-900',
    email_verified: 'bg-sky-100 text-sky-900',
    approved: 'bg-emerald-100 text-emerald-900',
    rejected: 'bg-rose-100 text-rose-900',
  }[it.status] || 'bg-neutral-100';
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold">{it.clinicName}</div>
          <div className="text-sm text-neutral-900/70">{it.address || '—'}</div>
          <div className="text-sm mt-1">
            <strong>{it.adminName}</strong> · {it.adminEmail} · {it.adminPhone || '—'}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Submitted {new Date(it.createdAt).toLocaleString()}
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>{it.status}</span>
      </div>

      {canReview && (
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (confirm(`Approve ${it.clinicName}? This creates the live clinic + admin user.`)) onApprove(); }}
            className="btn-primary inline-flex items-center gap-1"
          >
            <Check size={14} /> Approve
          </button>
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="Rejection reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (confirm(`Reject ${it.clinicName}?`)) onReject(reason); }}
            className="px-3 py-2 rounded-lg bg-rose-600 text-white font-semibold inline-flex items-center gap-1"
          >
            <X size={14} /> Reject
          </button>
        </div>
      )}

      {it.status === 'rejected' && it.rejectionReason && (
        <div className="mt-2 text-sm text-rose-900/80">Reason: {it.rejectionReason}</div>
      )}
    </div>
  );
}
