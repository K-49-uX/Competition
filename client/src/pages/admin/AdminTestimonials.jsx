import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Star,
  StarOff,
  Trash2,
  RefreshCw,
  Loader2,
  MessageSquareQuote,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';

const TABS = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function AdminTestimonials() {
  const [tab, setTab] = useState('pending');
  const qc = useQueryClient();
  const { push } = useToast();

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ['admin-testimonials', tab],
    queryFn: () => api.get(`/testimonials/admin?status=${tab}&limit=200`).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/testimonials/admin/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-testimonials'] });
      qc.invalidateQueries({ queryKey: ['public-testimonials'] });
    },
    onError: () => push('Update failed.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/testimonials/admin/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-testimonials'] });
      qc.invalidateQueries({ queryKey: ['public-testimonials'] });
      push('Testimonial deleted.', 'info');
    },
    onError: () => push('Delete failed.', 'error'),
  });

  const items = data?.testimonials || [];
  const counts = data?.counts || {};

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareQuote size={22} className="text-primary" /> Testimonials
          </h1>
          <p className="text-sm text-neutral-900/70 dark:text-slate-400">
            Review patient and partner stories before they appear on the website.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-outline !py-2 !px-3 inline-flex items-center gap-1 text-sm"
          disabled={isFetching}
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
              tab === tb.id
                ? 'bg-primary text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            {tb.label}
            {counts[tb.id] != null && <span className="ms-1 opacity-70">({counts[tb.id]})</span>}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="card text-neutral-500 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!isPending && items.length === 0 && (
        <div className="card text-neutral-500">Nothing here yet.</div>
      )}

      <div className="space-y-3">
        {items.map((t) => (
          <TestimonialRow
            key={t._id}
            t={t}
            onApprove={() => patch.mutate({ id: t._id, body: { status: 'approved' } })}
            onReject={() => patch.mutate({ id: t._id, body: { status: 'rejected' } })}
            onToggleFeature={() => patch.mutate({ id: t._id, body: { featured: !t.featured } })}
            onDelete={() => {
              if (window.confirm('Delete this testimonial permanently?')) remove.mutate(t._id);
            }}
            busy={patch.isPending || remove.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function TestimonialRow({ t, onApprove, onReject, onToggleFeature, onDelete, busy }) {
  const statusColor = {
    pending: 'bg-warning/15 text-warning',
    approved: 'bg-success/15 text-success',
    rejected: 'bg-danger/15 text-danger',
    withdrawn: 'bg-neutral-200 text-neutral-700',
  }[t.status] || 'bg-neutral-200 text-neutral-700';

  return (
    <article className="card-flat !p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-bold text-neutral-900 dark:text-white">
            {t.name}
            {t.featured && <Star size={14} className="inline ms-2 text-warning fill-warning" />}
          </div>
          <div className="text-xs text-neutral-500 dark:text-slate-400">
            {t.role}
            {t.location && ` · ${t.location}`}
            {' · '}
            <span className="uppercase">{t.language}</span>
            {' · '}
            {new Date(t.createdAt).toLocaleString()}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wide font-bold ${statusColor}`}>
          {t.status}
        </span>
      </div>

      <blockquote className="text-neutral-800 dark:text-slate-200 italic border-s-4 border-primary ps-3 py-1 my-3">
        “{t.quote}”
      </blockquote>

      <details className="text-xs text-neutral-500 dark:text-slate-400 mb-3">
        <summary className="cursor-pointer">Consent record</summary>
        <p className="mt-1">
          Given {new Date(t.consentGivenAt).toLocaleString()} — text:
          <span className="block mt-1 text-neutral-700 dark:text-slate-300">“{t.consentText}”</span>
        </p>
      </details>

      <div className="flex flex-wrap gap-2">
        {t.status !== 'approved' && (
          <button onClick={onApprove} disabled={busy} className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1">
            <CheckCircle2 size={14} /> Approve
          </button>
        )}
        {t.status !== 'rejected' && (
          <button onClick={onReject} disabled={busy} className="btn-outline !py-1.5 !px-3 text-sm inline-flex items-center gap-1">
            <XCircle size={14} /> Reject
          </button>
        )}
        {t.status === 'approved' && (
          <button onClick={onToggleFeature} disabled={busy} className="btn-outline !py-1.5 !px-3 text-sm inline-flex items-center gap-1">
            {t.featured ? <><StarOff size={14} /> Unfeature</> : <><Star size={14} /> Feature</>}
          </button>
        )}
        <button onClick={onDelete} disabled={busy} className="!py-1.5 !px-3 text-sm inline-flex items-center gap-1 text-danger hover:underline">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </article>
  );
}
