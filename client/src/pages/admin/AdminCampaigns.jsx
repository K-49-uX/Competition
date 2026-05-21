import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';

export default function AdminCampaigns() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = useState({ title: '', message: '', audience: 'all' });
  const [busy, setBusy] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.notifications),
  });

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/notifications/campaign', form);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setForm({ title: '', message: '', audience: 'all' });
      push('Sent', 'success');
    } catch {
      push(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="text-xl font-bold text-primary mb-4">{t('admin.tabs.campaigns')}</h2>
        <form onSubmit={send} className="space-y-3">
          <div>
            <label className="label">{t('admin.campaignTitle')}</label>
            <input className="input" required value={form.title} onChange={update('title')} />
          </div>
          <div>
            <label className="label">{t('admin.campaignMessage')}</label>
            <textarea className="input min-h-[120px]" required value={form.message} onChange={update('message')} />
          </div>
          <div>
            <label className="label">{t('admin.audience')}</label>
            <select className="input" value={form.audience} onChange={update('audience')}>
              <option value="all">All</option>
              <option value="patients">Patients</option>
              <option value="clinicians">Clinicians</option>
              <option value="admins">Admins</option>
            </select>
          </div>
          <button disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t('admin.send')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-primary mb-4">Recent</h2>
        <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
          {(notes || []).map((n) => (
            <li key={n._id} className="border-b border-neutral-50 dark:border-slate-700 pb-3 last:border-0">
              <div className="font-semibold text-neutral-900 dark:text-slate-100">{n.title}</div>
              <div className="text-sm text-neutral-900/70 dark:text-slate-300">{n.message}</div>
              <div className="text-xs text-neutral-900/50 dark:text-slate-400 mt-1">
                {n.audience} · {new Date(n.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {(!notes || notes.length === 0) && <li className="text-neutral-900/60 dark:text-slate-400 text-sm">—</li>}
        </ul>
      </div>
    </div>
  );
}
