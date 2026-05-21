import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Inbox, Phone, User as UserIcon, MapPin, Filter, RefreshCw, FileText, AlertTriangle, X, Loader2, Video, Pill, Trash2 } from 'lucide-react';
import { api, openAuthenticatedHtml } from '../../api/client.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const STATUS_TONE = {
  waiting:   'chip-primary',
  serving:   'chip-success',
  completed: 'chip-accent',
  cancelled: 'chip-danger',
};

// Visual + ordering for triage severities. Keys must match the server's
// SEVERITY_ORDER enum.
const SEVERITY_TONE = {
  none:     { label: 'No triage', cls: 'chip-care' },
  low:      { label: 'Low',       cls: 'chip-success' },
  moderate: { label: 'Moderate',  cls: 'chip-warning' },
  high:     { label: 'High',      cls: 'chip-danger' },
  critical: { label: 'Critical',  cls: 'chip-danger ring-2 ring-danger animate-pulse' },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminAppointments() {
  useDocumentTitle('Appointments inbox');
  const [date, setDate] = useState(todayKey());
  const [clinicId, setClinicId] = useState('');
  const [status, setStatus] = useState('');
  const [triageFor, setTriageFor] = useState(null);
  const [rxFor, setRxFor] = useState(null);

  const { data: clinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-appointments', date, clinicId, status],
    queryFn: () =>
      api
        .get('/appointments/admin', {
          params: {
            date: date || undefined,
            clinicId: clinicId || undefined,
            status: status || undefined,
          },
        })
        .then((r) => r.data),
  });

  const items = data?.appointments || [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary dark:text-accent">Appointments inbox</h1>
          <p className="text-sm text-neutral-600 dark:text-slate-400">
            All bookings — by registered patients and by guests.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-outline text-sm !py-2"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card-flat flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-slate-300">
          <Filter size={14} /> Filter
        </div>
        <label className="text-sm">
          <div className="label">Date</div>
          <input
            type="date"
            className="input !py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <div className="label">Clinic</div>
          <select
            className="input !py-2"
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
          >
            <option value="">All clinics</option>
            {clinics?.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="label">Status</div>
          <select
            className="input !py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any</option>
            <option value="waiting">Waiting</option>
            <option value="serving">Serving</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div className="ms-auto text-xs text-neutral-500 dark:text-slate-400">
          {items.length} result{items.length === 1 ? '' : 's'}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <Skeleton className="h-5 w-1/2 mb-3" />
              <Skeleton className="h-3 w-2/3 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No appointments match"
          body="Try a different date, clinic or status."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((a) => {
            const isGuest = !a.patientId;
            const name = isGuest ? a.guest?.patientName : a.patientId?.name;
            const phone = isGuest ? a.guest?.patientPhone : a.patientId?.phone;
            return (
              <div key={a._id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">
                      Ticket #
                    </div>
                    <div className="text-3xl font-extrabold text-primary dark:text-accent">
                      {a.ticketNumber}
                    </div>
                  </div>
                  <div className="text-end">
                    <span className={STATUS_TONE[a.status] || 'chip-primary'}>{a.status}</span>
                    {(() => {
                      const sev = a.triage?.severity || 'none';
                      const tone = SEVERITY_TONE[sev];
                      if (sev === 'none' && !(a.triage?.selfReportedSymptoms?.length)) return null;
                      return (
                        <div className="mt-1">
                          <span className={tone.cls}>
                            {sev === 'critical' || sev === 'high' ? <AlertTriangle size={12} /> : null}
                            {tone.label}
                          </span>
                          {a.triage?.selfReportedSymptoms?.length > 0 && sev === 'none' && (
                            <div className="text-[10px] mt-1 text-warning-600">self-reported</div>
                          )}
                        </div>
                      );
                    })()}
                    {isGuest && (
                      <div className="mt-1 text-[11px] uppercase font-bold text-care dark:text-care-100">
                        Guest
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                    <UserIcon size={14} /> {name || '—'}
                    {a.guest?.patientAge != null && (
                      <span className="text-xs font-normal text-neutral-500 dark:text-slate-400">
                        · {a.guest.patientAge}y
                      </span>
                    )}
                    {a.guest?.patientSex && (
                      <span className="text-xs font-normal text-neutral-500 dark:text-slate-400">
                        · {a.guest.patientSex}
                      </span>
                    )}
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2 text-neutral-700 dark:text-slate-300">
                      <Phone size={14} />
                      <a className="hover:underline" href={`tel:${phone}`}>{phone}</a>
                    </div>
                  )}
                  {a.clinicId?.name && (
                    <div className="flex items-center gap-2 text-neutral-700 dark:text-slate-300">
                      <MapPin size={14} /> {a.clinicId.name}
                    </div>
                  )}
                  {a.reason && (
                    <div className="text-neutral-700 dark:text-slate-300 mt-2">
                      <span className="font-semibold">Reason: </span>{a.reason}
                    </div>
                  )}
                  {isGuest && (a.guest?.helperName || a.guest?.helperPhone) && (
                    <div className="text-xs text-neutral-500 dark:text-slate-400 mt-2 border-t border-neutral-100 dark:border-slate-800 pt-2">
                      Booked by {a.guest.helperName || '—'}
                      {a.guest.helperPhone ? ` (${a.guest.helperPhone})` : ''}
                      {a.guest.relationship ? ` · ${a.guest.relationship}` : ''}
                    </div>
                  )}
                  <div className="text-xs text-neutral-400 dark:text-slate-500 mt-2">
                    Created {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                {!isGuest && a.patientId?._id && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-slate-800 flex flex-wrap gap-2">
                    <Link
                      to={`/admin/patients/${a.patientId._id}`}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <FileText size={12} /> View health record
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTriageFor(a)}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <AlertTriangle size={12} /> Set triage
                    </button>
                    <Link
                      to={`/teleconsult/${a._id}`}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Video size={12} /> {a.teleconsult?.enabled ? 'Join video' : 'Start tele-consult'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRxFor(a)}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Pill size={12} /> Write prescription
                    </button>
                  </div>
                )}
                {isGuest && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-slate-800 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTriageFor(a)}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <AlertTriangle size={12} /> Set triage
                    </button>
                    <button
                      type="button"
                      onClick={() => setRxFor(a)}
                      className="btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Pill size={12} /> Write prescription
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {triageFor && (
        <TriageModal
          appointment={triageFor}
          onClose={() => setTriageFor(null)}
          onSaved={() => {
            setTriageFor(null);
            refetch();
          }}
        />
      )}
      {rxFor && (
        <PrescriptionModal
          appointment={rxFor}
          onClose={() => setRxFor(null)}
        />
      )}
    </div>
  );
}

const SEVERITIES = ['none', 'low', 'moderate', 'high', 'critical'];

function TriageModal({ appointment, onClose, onSaved }) {
  const { push } = useToast();
  const [severity, setSeverity] = useState(appointment.triage?.severity || 'none');
  const [notes, setNotes] = useState(appointment.triage?.notes || '');

  const save = useMutation({
    mutationFn: () =>
      api.post(`/appointments/${appointment._id}/triage`, { severity, notes: notes || undefined }).then((r) => r.data),
    onSuccess: () => {
      push('Triage updated.', 'success');
      onSaved();
    },
    onError: () => push('Could not save triage.', 'error'),
  });

  const symptoms = appointment.triage?.selfReportedSymptoms || [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">Set triage</h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Ticket #{appointment.ticketNumber} · {appointment.guest?.patientName || appointment.patientId?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-danger" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {symptoms.length > 0 && (
          <div className="card-flat border-warning/40 bg-warning/5 text-xs mb-3">
            <div className="font-bold text-warning-600 mb-1">Patient self-reported:</div>
            <ul className="list-disc ms-4 space-y-0.5 text-neutral-700 dark:text-slate-300">
              {symptoms.map((s) => <li key={s}>{s.replace(/_/g, ' ')}</li>)}
            </ul>
          </div>
        )}

        <label className="label">Severity</label>
        <div className="grid grid-cols-5 gap-1 mb-3">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`text-xs py-2 rounded-md border transition ${severity === s
                ? 'bg-primary text-white border-primary'
                : 'border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="label">Notes (optional)</label>
        <textarea
          className="input min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Brief assessment context for the next clinician."
        />

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="btn-outline !py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="btn-primary !py-2 text-sm inline-flex items-center gap-1"
          >
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            Save triage
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_RX_ITEM = { drug: '', dose: '', frequency: '', durationDays: '', instructions: '' };

function PrescriptionModal({ appointment, onClose }) {
  const { push } = useToast();
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_RX_ITEM }]);
  const [notes, setNotes] = useState('');
  const [issuedId, setIssuedId] = useState(null);

  const create = useMutation({
    mutationFn: () =>
      api
        .post('/prescriptions', {
          appointmentId: appointment._id,
          diagnosis: diagnosis || undefined,
          notes: notes || undefined,
          // Server rejects items with empty drug name, so filter on the
          // client too — saves a roundtrip and gives a clearer error path.
          items: items
            .filter((i) => i.drug.trim().length > 0)
            .map((i) => ({
              drug: i.drug.trim(),
              dose: i.dose || undefined,
              frequency: i.frequency || undefined,
              durationDays: i.durationDays === '' ? undefined : Number(i.durationDays),
              instructions: i.instructions || undefined,
            })),
        })
        .then((r) => r.data),
    onSuccess: (r) => {
      push('Prescription created.', 'success');
      setIssuedId(r.prescription._id);
    },
    onError: () => push('Could not save prescription. Check the items.', 'error'),
  });

  function updateItem(idx, key, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="card w-full max-w-2xl my-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold inline-flex items-center gap-2">
              <Pill size={18} className="text-primary" /> Write prescription
            </h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Ticket #{appointment.ticketNumber} · {appointment.guest?.patientName || appointment.patientId?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-danger" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {issuedId ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-success-600 font-bold">Prescription saved.</div>
            <div className="flex justify-center gap-2">
              <a
                href={`/api/prescriptions/${issuedId}/html`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.preventDefault(); openAuthenticatedHtml(`/prescriptions/${issuedId}/html`); }}
                className="btn-primary !py-2 text-sm inline-flex items-center gap-1"
              >
                <FileText size={14} /> Open printable
              </a>
              <button onClick={onClose} className="btn-outline !py-2 text-sm">Close</button>
            </div>
          </div>
        ) : (
          <>
            <label className="label">Diagnosis (optional)</label>
            <input
              className="input mb-3"
              maxLength={500}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute pharyngitis"
            />

            <div className="label flex items-center justify-between">
              <span>Medications</span>
              <button
                type="button"
                onClick={() => setItems((p) => [...p, { ...EMPTY_RX_ITEM }])}
                className="text-xs text-primary hover:underline"
              >
                + Add medication
              </button>
            </div>
            <div className="space-y-2 mb-3">
              {items.map((it, idx) => (
                <div key={idx} className="card-flat !p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-500">#{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                        className="text-xs text-danger hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                  <input
                    className="input !py-1.5 text-sm"
                    placeholder="Medication name *"
                    value={it.drug}
                    onChange={(e) => updateItem(idx, 'drug', e.target.value)}
                    maxLength={160}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input !py-1.5 text-sm" placeholder="Dose (e.g. 500mg)" value={it.dose} onChange={(e) => updateItem(idx, 'dose', e.target.value)} maxLength={80} />
                    <input className="input !py-1.5 text-sm" placeholder="Frequency (e.g. BID)" value={it.frequency} onChange={(e) => updateItem(idx, 'frequency', e.target.value)} maxLength={80} />
                    <input className="input !py-1.5 text-sm" type="number" min="1" max="365" placeholder="Days" value={it.durationDays} onChange={(e) => updateItem(idx, 'durationDays', e.target.value)} />
                  </div>
                  <input className="input !py-1.5 text-sm" placeholder="Instructions (e.g. after meals)" value={it.instructions} onChange={(e) => updateItem(idx, 'instructions', e.target.value)} maxLength={500} />
                </div>
              ))}
            </div>

            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[60px]"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Follow-up plan, allergies considered, etc."
            />

            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={onClose} className="btn-outline !py-2 text-sm">Cancel</button>
              <button
                type="button"
                disabled={create.isPending || !items.some((i) => i.drug.trim())}
                onClick={() => create.mutate()}
                className="btn-primary !py-2 text-sm inline-flex items-center gap-1"
              >
                {create.isPending && <Loader2 size={14} className="animate-spin" />}
                Save prescription
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
