import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  HeartPulse,
  AlertTriangle,
  Pill,
  Stethoscope,
  Syringe,
  Plus,
  X,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';

const BLOOD_TYPES = ['unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function AdminPatientRecord() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { push } = useToast();

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['patient-record', id],
    queryFn: () => api.get(`/patients/${id}/record`).then((r) => r.data),
  });

  const patchRecord = useMutation({
    mutationFn: (body) => api.patch(`/patients/${id}/record`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-record', id] });
      push('Record updated.', 'success');
    },
    onError: () => push('Update failed.', 'error'),
  });

  const addItem = useMutation({
    mutationFn: ({ kind, body }) => api.post(`/patients/${id}/record/${kind}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-record', id] });
      push('Added.', 'success');
    },
    onError: () => push('Could not add. Check fields.', 'error'),
  });

  const removeItem = useMutation({
    mutationFn: ({ kind, itemId }) => api.delete(`/patients/${id}/record/${kind}/${itemId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-record', id] }),
    onError: () => push('Could not remove.', 'error'),
  });

  if (isPending) {
    return (
      <div className="card text-neutral-500 inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="card-flat border-danger/30 bg-danger/5 text-danger text-sm">
        Could not load this patient record.
      </div>
    );
  }

  const { patient, record, visits } = data;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/admin/appointments" className="inline-flex items-center gap-1 text-sm text-primary mb-2">
            <ArrowLeft size={14} /> Back to appointments
          </Link>
          <h1 className="text-2xl font-bold">{patient.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            {patient.phone || patient.email || '—'}
            {patient.language && ` · ${patient.language.toUpperCase()}`}
            {patient.createdAt && ` · Patient since ${new Date(patient.createdAt).toLocaleDateString()}`}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-outline !py-2 !px-3 text-sm inline-flex items-center gap-1">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <SummaryCard
        record={record}
        onSave={(body) => patchRecord.mutate(body)}
        saving={patchRecord.isPending}
      />

      <Section
        title="Vitals"
        icon={HeartPulse}
        items={record.vitals}
        renderItem={(v) => (
          <>
            <span className="font-bold">{new Date(v.at).toLocaleDateString()}</span>
            {v.temperatureC != null && ` · T ${v.temperatureC}°C`}
            {v.heartRate != null && ` · HR ${v.heartRate}`}
            {v.bloodPressureSystolic != null && ` · BP ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic ?? '?'}`}
            {v.spo2 != null && ` · SpO₂ ${v.spo2}%`}
            {v.weightKg != null && ` · ${v.weightKg}kg`}
            {v.notes && <div className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{v.notes}</div>}
          </>
        )}
        adder={(close) => (
          <VitalsForm
            onSubmit={(body) => addItem.mutate({ kind: 'vitals', body }, { onSuccess: close })}
            busy={addItem.isPending}
          />
        )}
        onRemove={(itemId) => removeItem.mutate({ kind: 'vitals', itemId })}
      />

      <Section
        title="Allergies"
        icon={AlertTriangle}
        items={record.allergies}
        renderItem={(a) => (
          <>
            <span className="font-bold">{a.substance}</span>
            {a.reaction && ` — ${a.reaction}`}
            <span className={`ms-2 chip-${severityTone(a.severity)} !text-[10px]`}>{a.severity}</span>
          </>
        )}
        adder={(close) => (
          <SimpleForm
            fields={[
              { name: 'substance', label: 'Substance', required: true },
              { name: 'reaction', label: 'Reaction' },
              { name: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe', 'life-threatening'], default: 'mild' },
            ]}
            onSubmit={(body) => addItem.mutate({ kind: 'allergies', body }, { onSuccess: close })}
            busy={addItem.isPending}
          />
        )}
        onRemove={(itemId) => removeItem.mutate({ kind: 'allergies', itemId })}
      />

      <Section
        title="Conditions"
        icon={Stethoscope}
        items={record.conditions}
        renderItem={(c) => (
          <>
            <span className="font-bold">{c.name}</span>
            {c.icd10 && <span className="text-xs text-neutral-500 ms-2">{c.icd10}</span>}
            <span className={`ms-2 chip-${c.status === 'active' ? 'danger' : 'success'} !text-[10px]`}>{c.status}</span>
            {c.notes && <div className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{c.notes}</div>}
          </>
        )}
        adder={(close) => (
          <SimpleForm
            fields={[
              { name: 'name', label: 'Condition', required: true },
              { name: 'icd10', label: 'ICD-10' },
              { name: 'status', label: 'Status', type: 'select', options: ['active', 'resolved', 'remission'], default: 'active' },
              { name: 'notes', label: 'Notes' },
            ]}
            onSubmit={(body) => addItem.mutate({ kind: 'conditions', body }, { onSuccess: close })}
            busy={addItem.isPending}
          />
        )}
        onRemove={(itemId) => removeItem.mutate({ kind: 'conditions', itemId })}
      />

      <Section
        title="Medications"
        icon={Pill}
        items={record.medications}
        renderItem={(m) => (
          <>
            <span className="font-bold">{m.name}</span>
            {m.dose && ` · ${m.dose}`}
            {m.frequency && ` · ${m.frequency}`}
            {m.route && ` · ${m.route}`}
            {m.stoppedAt && <span className="ms-2 chip-care !text-[10px]">stopped</span>}
            {m.notes && <div className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{m.notes}</div>}
          </>
        )}
        adder={(close) => (
          <SimpleForm
            fields={[
              { name: 'name', label: 'Medication', required: true },
              { name: 'dose', label: 'Dose (e.g. 500mg)' },
              { name: 'frequency', label: 'Frequency (e.g. BID)' },
              { name: 'route', label: 'Route', default: 'oral' },
              { name: 'notes', label: 'Notes' },
            ]}
            onSubmit={(body) => addItem.mutate({ kind: 'medications', body }, { onSuccess: close })}
            busy={addItem.isPending}
          />
        )}
        onRemove={(itemId) => removeItem.mutate({ kind: 'medications', itemId })}
      />

      <Section
        title="Immunisations"
        icon={Syringe}
        items={record.immunisations}
        renderItem={(im) => (
          <>
            <span className="font-bold">{im.vaccine}</span>
            {im.doseNumber && ` · dose ${im.doseNumber}`}
            {im.administeredAt && ` · ${new Date(im.administeredAt).toLocaleDateString()}`}
            {im.lotNumber && <span className="text-xs text-neutral-500 ms-2">lot {im.lotNumber}</span>}
          </>
        )}
        adder={(close) => (
          <SimpleForm
            fields={[
              { name: 'vaccine', label: 'Vaccine', required: true },
              { name: 'doseNumber', label: 'Dose #', type: 'number', default: 1 },
              { name: 'lotNumber', label: 'Lot number' },
            ]}
            onSubmit={(body) => addItem.mutate({ kind: 'immunisations', body }, { onSuccess: close })}
            busy={addItem.isPending}
          />
        )}
        onRemove={(itemId) => removeItem.mutate({ kind: 'immunisations', itemId })}
      />

      <VisitNotesPanel visits={visits} />
    </div>
  );
}

function severityTone(s) {
  if (s === 'life-threatening') return 'danger';
  if (s === 'severe') return 'danger';
  if (s === 'moderate') return 'primary';
  return 'success';
}

function SummaryCard({ record, onSave, saving }) {
  const [bloodType, setBloodType] = useState(record.bloodType || 'unknown');
  const [summary, setSummary] = useState(record.summary || '');
  const dirty = bloodType !== (record.bloodType || 'unknown') || summary !== (record.summary || '');
  return (
    <section className="card-flat !p-5">
      <h2 className="font-bold text-lg mb-3">Summary</h2>
      <div className="grid sm:grid-cols-[180px_1fr] gap-3">
        <label className="block">
          <span className="label">Blood type</span>
          <select className="input" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
            {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Clinical summary</span>
          <textarea
            className="input min-h-[100px]"
            placeholder="Pertinent history, ongoing concerns, social context…"
            maxLength={2000}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
      </div>
      <div className="flex justify-end mt-3">
        <button
          className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          disabled={!dirty || saving}
          onClick={() => onSave({ bloodType, summary })}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save summary
        </button>
      </div>
      {record.lastReviewedAt && (
        <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">
          Last reviewed {new Date(record.lastReviewedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}

function Section({ title, icon: Icon, items, renderItem, adder, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card-flat !p-5">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Icon size={18} className="text-primary" /> {title}
          <span className="text-xs font-normal text-neutral-500">({items.length})</span>
        </h2>
        <button
          className="btn-outline !py-1.5 !px-3 text-sm inline-flex items-center gap-1"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add</>}
        </button>
      </header>
      {open && <div className="mb-3">{adder(() => setOpen(false))}</div>}
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">No entries yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-slate-800">
          {items.map((it) => (
            <li key={it._id} className="py-2 text-sm flex items-start justify-between gap-2">
              <div className="text-neutral-800 dark:text-slate-200">{renderItem(it)}</div>
              <button
                onClick={() => onRemove(it._id)}
                className="text-xs text-danger hover:underline shrink-0"
                title="Remove"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VitalsForm({ onSubmit, busy }) {
  const [v, setV] = useState({});
  const num = (k) => (e) => {
    const val = e.target.value;
    setV((prev) => ({ ...prev, [k]: val === '' ? undefined : Number(val) }));
  };
  return (
    <form
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned = Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && !Number.isNaN(val)));
        if (!Object.keys(cleaned).length) return;
        onSubmit(cleaned);
      }}
    >
      <NumField label="Temp °C" onChange={num('temperatureC')} step="0.1" />
      <NumField label="HR" onChange={num('heartRate')} />
      <NumField label="BP sys" onChange={num('bloodPressureSystolic')} />
      <NumField label="BP dia" onChange={num('bloodPressureDiastolic')} />
      <NumField label="SpO₂ %" onChange={num('spo2')} />
      <NumField label="Weight kg" onChange={num('weightKg')} step="0.1" />
      <button className="btn-primary !py-2 !px-3 text-sm sm:col-span-2 inline-flex items-center justify-center gap-1" disabled={busy}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        Save vitals
      </button>
    </form>
  );
}

function NumField({ label, onChange, step }) {
  return (
    <label className="block text-xs">
      <span className="label !mb-0.5">{label}</span>
      <input type="number" inputMode="decimal" step={step || '1'} className="input !py-1.5 !px-2" onChange={onChange} />
    </label>
  );
}

function SimpleForm({ fields, onSubmit, busy }) {
  const initial = Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']));
  const [v, setV] = useState(initial);
  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned = {};
        for (const f of fields) {
          let val = v[f.name];
          if (val === '' || val == null) continue;
          if (f.type === 'number') val = Number(val);
          cleaned[f.name] = val;
        }
        onSubmit(cleaned);
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="block text-xs">
          <span className="label !mb-0.5">
            {f.label}{f.required && ' *'}
          </span>
          {f.type === 'select' ? (
            <select
              className="input !py-1.5"
              value={v[f.name]}
              onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))}
              required={f.required}
            >
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              className="input !py-1.5"
              type={f.type || 'text'}
              value={v[f.name]}
              onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))}
              required={f.required}
            />
          )}
        </label>
      ))}
      <button className="btn-primary !py-2 !px-3 text-sm sm:col-span-2 inline-flex items-center justify-center gap-1" disabled={busy}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        Save
      </button>
    </form>
  );
}

function VisitNotesPanel({ visits }) {
  return (
    <section className="card-flat !p-5">
      <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
        <FileText size={18} className="text-primary" /> Visit notes
        <span className="text-xs font-normal text-neutral-500">({visits.length})</span>
      </h2>
      {visits.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">
          Visit notes will appear here once a clinician documents an appointment from the appointments inbox.
        </p>
      ) : (
        <ul className="space-y-3">
          {visits.map((n) => (
            <li key={n._id} className="border-s-4 border-primary ps-3 py-1">
              <div className="text-sm font-bold">{new Date(n.visitedAt).toLocaleString()}</div>
              {n.chiefComplaint && <div className="text-sm">CC: {n.chiefComplaint}</div>}
              {n.assessment && <div className="text-sm"><span className="font-semibold">A:</span> {n.assessment}</div>}
              {n.plan && <div className="text-sm"><span className="font-semibold">P:</span> {n.plan}</div>}
              {n.visibility === 'clinician_only' && (
                <span className="chip-care !text-[10px] mt-1 inline-block">private</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
