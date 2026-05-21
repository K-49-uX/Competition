import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Trash2, Loader2, X, Shield, Stethoscope } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

// Phase 3.2 — Clinic admins manage their staff. Superadmins additionally
// get a clinic switcher (reuses /api/admin/clinics for the dropdown).
export default function AdminStaff() {
  const { user } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const isSuper = user?.role === 'admin';
  const [selectedClinic, setSelectedClinic] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const clinicsQuery = useQuery({
    queryKey: ['admin-clinics-mine'],
    queryFn: () => api.get('/admin/clinics').then((r) => r.data.clinics || []),
    staleTime: 60_000,
  });

  // Scoped admins ignore the dropdown — server enforces.
  const targetClinic = isSuper ? selectedClinic || clinicsQuery.data?.[0]?._id : null;
  const staffParams = isSuper && targetClinic ? { clinicId: targetClinic } : {};

  const staffQuery = useQuery({
    queryKey: ['admin-staff', targetClinic || 'mine'],
    enabled: !isSuper || !!targetClinic,
    queryFn: () => api.get('/admin/staff', { params: staffParams }).then((r) => r.data),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }) => api.patch(`/admin/staff/${id}/role`, { role }).then((r) => r.data),
    onSuccess: () => {
      push('Role updated.', 'success');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err) => push(err?.response?.data?.error || 'Could not update role.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/staff/${id}`).then((r) => r.data),
    onSuccess: () => {
      push('Staff member removed.', 'success');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err) => push(err?.response?.data?.error || 'Could not remove.', 'error'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            <Users className="text-primary" size={22} /> Staff
          </h1>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            {isSuper ? 'Manage clinicians and clinic admins per clinic.' : 'Manage your clinic\u2019s staff.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuper && clinicsQuery.data && (
            <select
              className="input !py-1.5 text-sm"
              value={targetClinic || ''}
              onChange={(e) => setSelectedClinic(e.target.value)}
            >
              {clinicsQuery.data.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setInviteOpen(true)} className="btn-primary !py-1.5 text-sm inline-flex items-center gap-1">
            <UserPlus size={14} /> Invite staff
          </button>
        </div>
      </div>

      {staffQuery.isPending && (
        <div className="grid place-items-center py-12">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      )}
      {staffQuery.isError && <div className="card text-danger">Could not load staff.</div>}
      {staffQuery.data && (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffQuery.data.staff.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-neutral-500">No staff yet. Invite the first member.</td></tr>
              )}
              {staffQuery.data.staff.map((s) => (
                <tr key={s._id} className="border-t border-neutral-100">
                  <td className="p-3 font-semibold">{s.name}</td>
                  <td className="p-3 text-neutral-600">{s.phone || s.email || ''}</td>
                  <td className="p-3">
                    <RolePill role={s.role} />
                  </td>
                  <td className="p-3 text-neutral-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {String(s._id) === String(user.id) ? (
                      <span className="text-xs text-neutral-400">you</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        <select
                          className="input !py-1 text-xs"
                          value={s.role}
                          onChange={(e) => setRole.mutate({ id: s._id, role: e.target.value })}
                          disabled={setRole.isPending}
                        >
                          <option value="clinician">clinician</option>
                          <option value="clinic_admin">clinic_admin</option>
                        </select>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${s.name}?`)) remove.mutate(s._id);
                          }}
                          className="text-danger hover:bg-danger/10 rounded p-1.5"
                          aria-label="Remove"
                          disabled={remove.isPending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <InviteStaffModal
          clinicId={targetClinic}
          isSuper={isSuper}
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['admin-staff'] });
            setInviteOpen(false);
            push('Staff invited.', 'success');
          }}
        />
      )}
    </div>
  );
}

function RolePill({ role }) {
  const map = {
    clinician:    { tone: 'bg-primary/10 text-primary', icon: Stethoscope },
    clinic_admin: { tone: 'bg-amber-100 text-amber-700', icon: Shield },
    admin:        { tone: 'bg-danger/10 text-danger', icon: Shield },
  };
  const m = map[role] || { tone: 'bg-neutral-100 text-neutral-600', icon: Users };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-bold ${m.tone}`}>
      <Icon size={12} /> {role}
    </span>
  );
}

function InviteStaffModal({ clinicId, isSuper, onClose, onCreated }) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', role: 'clinician' });
  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/staff/invite', {
        ...form,
        // Server resolves clinic from the caller's role; superadmins must
        // pass clinicId explicitly (they may have switched the dropdown).
        clinicId: isSuper ? clinicId : undefined,
      }).then((r) => r.data),
    onSuccess: onCreated,
    onError: (err) => push(err?.response?.data?.error || 'Could not invite.', 'error'),
  });

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-bold inline-flex items-center gap-2">
            <UserPlus size={18} className="text-primary" /> Invite staff
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-danger" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="label">Name *</label>
        <input className="input mb-2" value={form.name} onChange={(e) => setField('name', e.target.value)} />
        <label className="label">Phone</label>
        <input className="input mb-2" placeholder="+254700111222" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
        <label className="label">Email</label>
        <input className="input mb-2" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
        <label className="label">Temporary password (≥ 8 chars) *</label>
        <input className="input mb-2" type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
        <label className="label">Role *</label>
        <select className="input mb-3" value={form.role} onChange={(e) => setField('role', e.target.value)}>
          <option value="clinician">clinician</option>
          <option value="clinic_admin">clinic_admin</option>
        </select>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-outline !py-2 text-sm">Cancel</button>
          <button
            disabled={create.isPending || !form.name || !form.password}
            onClick={() => create.mutate()}
            className="btn-primary !py-2 text-sm inline-flex items-center gap-1"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}
