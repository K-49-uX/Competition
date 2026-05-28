import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CalendarCheck,
  Phone,
  User as UserIcon,
  MapPin,
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Languages,
  Users,
  Info,
  Printer,
  Search,
  Building2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import { api } from '../api/client.js';
import { getSocket } from '../realtime/socket.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const SEX_OPTIONS = [
  { value: 'female',          label: 'Female' },
  { value: 'male',            label: 'Male' },
  { value: 'other',           label: 'Other' },
  { value: 'prefer_not_say',  label: 'Prefer not to say' },
];

const SEX_LABEL = Object.fromEntries(SEX_OPTIONS.map((o) => [o.value, o.label]));

function formatDateLong(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const LANGS = ['English', 'Kiswahili', 'Arabic', 'French', 'Somali', 'Amharic', 'Tigrinya', 'Kirundi', 'Lingala'];

const initialForm = {
  clinicId: '',
  patientName: '',
  patientAge: '',
  patientSex: '',
  patientPhone: '',
  nationality: '',
  blockOrCamp: '',
  preferredLang: '',
  reason: '',
  scheduledDate: '',
  scheduledFor: '',
  helperName: '',
  helperPhone: '',
  relationship: '',
  selfReportedSymptoms: [],
  consent: false,
};

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function maxBookingDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function Field({ label, required, error, children, hint }) {
  return (
    <label className="block">
      <span className="label flex items-center gap-1">
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
      </span>
      {children}
      {hint && !error && <span className="help-text">{hint}</span>}
      {error && <span className="text-xs text-danger mt-1 block">{error}</span>}
    </label>
  );
}

// Patient self-reported red-flag symptoms. The keys here MUST match the
// server's RED_FLAG_SYMPTOMS catalogue in models/Appointment.js — the server
// rejects any other key. Showing a clear "call emergency services" banner the
// moment a critical symptom is checked is intentional: this form is not a
// replacement for emergency care.
const SYMPTOM_OPTIONS = [
  { key: 'chest_pain',           label: 'Chest pain',                   urgent: true },
  { key: 'difficulty_breathing', label: 'Difficulty breathing',         urgent: true },
  { key: 'severe_bleeding',      label: 'Severe bleeding',              urgent: true },
  { key: 'stroke_signs',         label: 'Sudden weakness / face droop', urgent: true },
  { key: 'unconscious',          label: 'Patient is unconscious',       urgent: true },
  { key: 'pregnancy_emergency',  label: 'Pregnancy emergency',          urgent: true },
  { key: 'high_fever_child',     label: 'High fever in a child',        urgent: false },
  { key: 'severe_pain',          label: 'Severe pain',                  urgent: false },
  { key: 'recent_injury',        label: 'Recent injury / fall',         urgent: false },
  { key: 'vomiting_diarrhea',    label: 'Vomiting / diarrhoea',         urgent: false },
];

function SymptomChecklist({ selected, onChange }) {
  const toggle = (key) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  };
  const anyUrgent = SYMPTOM_OPTIONS.some((o) => o.urgent && selected.includes(o.key));
  return (
    <div className="md:col-span-2">
      <div className="label flex items-center gap-1">
        <HeartPulse size={14} /> Are any of these happening now?
      </div>
      <p className="help-text mb-2">
        Tick anything that applies. Clinicians use this to see urgent cases first.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {SYMPTOM_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-neutral-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(opt.key)}
              onChange={() => toggle(opt.key)}
            />
            <span>
              {opt.label}
              {opt.urgent && (
                <span className="ms-1 text-xs text-danger font-semibold">· urgent</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {anyUrgent && (
        <div role="alert" className="mt-3 card-flat border-danger/40 bg-danger/5 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-danger">If this is life-threatening, call emergency services now.</div>
            <div className="text-xs text-neutral-700 dark:text-slate-300 mt-1">
              Booking flags your case as urgent so the clinic sees you first — but it does not replace an ambulance.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookAppointment() {
  useDocumentTitle('Book appointment');
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [liveQueue, setLiveQueue] = useState(null);
  // Two-step flow: first the patient picks a hospital from a list of cards,
  // then they fill in the booking form. Keeps the form short and focused.
  const [step, setStep] = useState('pick'); // 'pick' | 'form'
  const [submittedForm, setSubmittedForm] = useState(null);

  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
  });

  const selectedClinic = clinics?.find((c) => c._id === form.clinicId) || null;

  // Slots are issued by the clinic (not free-text from the patient) so the
  // hospital controls schedule density and prevents double bookings.
  const slotsQuery = useQuery({
    queryKey: ['appointment-slots', form.clinicId, form.scheduledDate],
    enabled: Boolean(form.clinicId && form.scheduledDate),
    queryFn: () =>
      api
        .get('/appointments/slots', {
          params: { clinicId: form.clinicId, date: form.scheduledDate },
        })
        .then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (payload) => {
      // Logged-in patients book against the authenticated endpoint so the
      // appointment is linked to their account (enables tele-consult, the
      // patient health record, "My prescriptions", etc.). Anonymous bookings
      // (helpers / shared phones) fall back to the public guest endpoint.
      if (user) {
        const authPayload = {
          clinicId: payload.clinicId,
          reason: payload.reason,
          scheduledFor: payload.scheduledFor,
          selfReportedSymptoms: payload.selfReportedSymptoms,
        };
        return api.post('/appointments', authPayload).then((r) => r.data);
      }
      return api.post('/appointments/guest', payload).then((r) => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      setSubmittedForm({ ...form, clinicName: selectedClinic?.name, clinicAddress: selectedClinic?.address });
      setErrors({});
      // Remember ticket+phone so the patient can find it again from /my-ticket.
      try {
        if (data?.appointment?.ticketNumber && data?.appointment?.guest?.patientPhone) {
          localStorage.setItem(
            'afya.lastTicket',
            JSON.stringify({
              ticket: data.appointment.ticketNumber,
              phone: data.appointment.guest.patientPhone,
              clinicName: data.appointment.clinicName,
              savedAt: Date.now(),
            })
          );
        }
      } catch { /* storage may be blocked */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => {
      const issues = err?.response?.data?.issues;
      if (Array.isArray(issues)) {
        const map = {};
        issues.forEach((i) => { map[i.path] = i.message; });
        setErrors(map);
      } else {
        const code = err?.response?.data?.error;
        const existing = err?.response?.data?.existing;
        const slotErrors = {
          slot_full: 'That slot just filled up. Please choose another time.',
          invalid_slot: 'Please choose a time slot from the list.',
          slot_in_past: 'That time has already passed. Pick a later slot.',
        };
        if (code === 'duplicate_active_booking') {
          const ticketStr = existing?.ticketNumber ? ` (ticket #${existing.ticketNumber}` : '';
          const clinicStr = existing?.clinicName ? ` at ${existing.clinicName})` : ticketStr ? ')' : '';
          setErrors({
            _form:
              `This phone number already has an active appointment${ticketStr}${clinicStr}. ` +
              `Please attend or cancel that one before booking again. You can find it on "My ticket".`,
          });
        } else if (slotErrors[code]) {
          setErrors({ scheduledFor: slotErrors[code], _form: slotErrors[code] });
        } else {
          setErrors({ _form: code || 'Something went wrong. Please try again.' });
        }
      }
    },
  });

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Changing clinic or date invalidates a previously chosen slot.
      if (field === 'clinicId' || field === 'scheduledDate') {
        next.scheduledFor = '';
      }
      return next;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.clinicId) e.clinicId = 'Please choose a clinic';
    if (!form.patientName.trim() || form.patientName.trim().length < 2) e.patientName = "Patient's full name is required";
    if (!form.patientPhone.trim() || form.patientPhone.trim().length < 7) e.patientPhone = 'A reachable phone number is required';
    if (form.patientAge !== '' && (Number(form.patientAge) < 0 || Number(form.patientAge) > 130)) e.patientAge = 'Enter a valid age';
    if (!form.consent) e.consent = 'You must accept to share these details with the clinic';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const payload = {
      clinicId: form.clinicId,
      reason: form.reason || undefined,
      scheduledFor: form.scheduledFor || undefined,
      patientName: form.patientName.trim(),
      patientAge: form.patientAge === '' ? undefined : Number(form.patientAge),
      patientSex: form.patientSex || undefined,
      patientPhone: form.patientPhone.trim(),
      nationality: form.nationality.trim() || undefined,
      blockOrCamp: form.blockOrCamp.trim() || undefined,
      preferredLang: form.preferredLang || undefined,
      helperName: form.helperName.trim() || undefined,
      helperPhone: form.helperPhone.trim() || undefined,
      relationship: form.relationship.trim() || undefined,
      selfReportedSymptoms: form.selfReportedSymptoms.length ? form.selfReportedSymptoms : undefined,
      consent: true,
    };
    mutation.mutate(payload);
  }

  // ---------------- success view ----------------
  if (result?.appointment) {
    return (
      <SuccessView
        result={result}
        patient={submittedForm}
        liveQueue={liveQueue}
        setLiveQueue={setLiveQueue}
        reset={() => {
          setResult(null);
          setLiveQueue(null);
          setSubmittedForm(null);
          setForm(initialForm);
          setStep('pick');
        }}
      />
    );
  }

  // ---------------- step 1: pick a hospital ----------------
  if (step === 'pick') {
    return (
      <ClinicPicker
        clinics={clinics}
        loading={clinicsLoading}
        onPick={(c) => {
          update('clinicId', c._id);
          setStep('form');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // ---------------- form view ----------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12 space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 chip-accent mb-2">
          <CalendarCheck size={14} /> Book an appointment
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
          Get a ticket — no account needed
        </h1>
        <p className="mt-2 text-neutral-700 dark:text-slate-300">
          If the patient does not have a phone, you can use someone else&apos;s phone to book on their behalf.
          Please fill the patient&apos;s details accurately so the clinic can prepare for them.
        </p>
      </header>

      {errors._form && (
        <div className="card-flat border-l-4 border-danger flex items-start gap-3">
          <AlertTriangle className="text-danger mt-0.5" size={20} />
          <div className="text-sm text-danger font-semibold">{errors._form}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6" noValidate>
        {/* --- Clinic (chosen in step 1) --- */}
        <fieldset className="space-y-3">
          <legend className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
            <Stethoscope size={18} className="text-primary dark:text-accent" />
            Booking at
          </legend>
          <div className="card-flat flex items-start justify-between gap-3 border-l-4 border-primary">
            <div className="min-w-0">
              <div className="font-bold text-neutral-900 dark:text-white truncate">
                {selectedClinic?.name || '—'}
              </div>
              {selectedClinic?.address && (
                <div className="text-sm text-neutral-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {selectedClinic.address}
                </div>
              )}
              {selectedClinic?.hours && (
                <div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                  <Clock size={12} /> {selectedClinic.hours}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost text-sm shrink-0"
              onClick={() => setStep('pick')}
            >
              <ChevronLeft size={14} /> Change
            </button>
          </div>
          {errors.clinicId && <div className="text-xs text-danger">{errors.clinicId}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Preferred date"
              hint="You can book up to 14 days ahead"
            >
              <input
                type="date"
                className="input"
                min={todayIso()}
                max={maxBookingDateIso()}
                value={form.scheduledDate}
                onChange={(e) => update('scheduledDate', e.target.value)}
                disabled={!form.clinicId}
              />
            </Field>
            <Field
              label="Available time slot"
              error={errors.scheduledFor}
              hint={
                !form.clinicId
                  ? 'Choose a clinic first'
                  : !form.scheduledDate
                    ? 'Choose a date to see available times'
                    : slotsQuery.isLoading
                      ? 'Loading clinic schedule…'
                      : 'Times are set by the clinic to keep the queue smooth'
              }
            >
              <select
                className="input"
                value={form.scheduledFor}
                onChange={(e) => update('scheduledFor', e.target.value)}
                disabled={!form.clinicId || !form.scheduledDate || slotsQuery.isLoading}
              >
                <option value="">
                  {!form.clinicId || !form.scheduledDate
                    ? '— Pick clinic & date first —'
                    : slotsQuery.isLoading
                      ? 'Loading…'
                      : '— Walk-in (next available) —'}
                </option>
                {slotsQuery.data?.slots
                  ?.filter((s) => !s.past)
                  .map((s) => (
                    <option key={s.time} value={s.time} disabled={s.full}>
                      {s.label} {s.full ? '— full' : `— ${s.remaining} left`}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Reason for visit" hint="Briefly describe symptoms or service needed">
              <input
                type="text"
                className="input"
                placeholder="e.g. Fever and cough for 3 days"
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                maxLength={500}
              />
            </Field>
            <SymptomChecklist
              selected={form.selfReportedSymptoms}
              onChange={(next) => update('selfReportedSymptoms', next)}
            />
          </div>
        </fieldset>

        {/* --- Patient --- */}
        <fieldset className="space-y-3 pt-4 border-t border-neutral-100 dark:border-slate-800">
          <legend className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
            <UserIcon size={18} className="text-primary dark:text-accent" />
            Patient details
          </legend>

          <Field label="Patient full name" required error={errors.patientName}>
            <input
              type="text"
              className="input"
              placeholder="e.g. Achol Deng"
              autoComplete="name"
              value={form.patientName}
              onChange={(e) => update('patientName', e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Age" error={errors.patientAge}>
              <input
                type="number"
                min="0"
                max="130"
                className="input"
                placeholder="e.g. 32"
                value={form.patientAge}
                onChange={(e) => update('patientAge', e.target.value)}
              />
            </Field>
            <Field label="Sex">
              <select
                className="input"
                value={form.patientSex}
                onChange={(e) => update('patientSex', e.target.value)}
              >
                <option value="">— Select —</option>
                {SEX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Preferred language">
              <select
                className="input"
                value={form.preferredLang}
                onChange={(e) => update('preferredLang', e.target.value)}
              >
                <option value="">— Select —</option>
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          <Field
            label="Patient phone (or a phone we can reach them on)"
            required
            error={errors.patientPhone}
            hint="If the patient has no phone, enter the phone of the person helping them."
          >
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="tel"
                className="input pl-9"
                placeholder="+254 7XX XXX XXX"
                autoComplete="tel"
                value={form.patientPhone}
                onChange={(e) => update('patientPhone', e.target.value)}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nationality / community" hint="Optional — helps the clinic prepare an interpreter">
              <input
                type="text"
                className="input"
                placeholder="e.g. South Sudanese"
                value={form.nationality}
                onChange={(e) => update('nationality', e.target.value)}
              />
            </Field>
            <Field label="Block, village or address">
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="e.g. Kakuma 1, Block A4"
                  value={form.blockOrCamp}
                  onChange={(e) => update('blockOrCamp', e.target.value)}
                />
              </div>
            </Field>
          </div>
        </fieldset>

        {/* --- Helper --- */}
        <fieldset className="space-y-3 pt-4 border-t border-neutral-100 dark:border-slate-800">
          <legend className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
            <Users size={18} className="text-primary dark:text-accent" />
            Booking on behalf of someone? <span className="text-xs font-normal text-neutral-500 dark:text-slate-400">(optional)</span>
          </legend>
          <p className="text-sm text-neutral-600 dark:text-slate-400">
            If you are using your phone to book for another person, please tell us who you are so the clinic can call back.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Your name">
              <input
                type="text"
                className="input"
                placeholder="e.g. Mary Akello"
                value={form.helperName}
                onChange={(e) => update('helperName', e.target.value)}
              />
            </Field>
            <Field label="Your phone">
              <input
                type="tel"
                className="input"
                placeholder="+254 7XX XXX XXX"
                value={form.helperPhone}
                onChange={(e) => update('helperPhone', e.target.value)}
              />
            </Field>
            <Field label="Relationship to patient">
              <input
                type="text"
                className="input"
                placeholder="e.g. Mother, neighbour, friend"
                value={form.relationship}
                onChange={(e) => update('relationship', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        {/* --- Consent --- */}
        <div className="pt-4 border-t border-neutral-100 dark:border-slate-800 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-neutral-300 text-primary focus:ring-primary"
              checked={form.consent}
              onChange={(e) => update('consent', e.target.checked)}
            />
            <span className="text-sm text-neutral-700 dark:text-slate-300">
              I confirm the information above is accurate and I consent to share it with the chosen clinic
              for the purpose of providing care. AfyaConnect will not share this with anyone else.
            </span>
          </label>
          {errors.consent && <div className="text-xs text-danger">{errors.consent}</div>}

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending}
            >
              <HeartPulse size={16} />
              {mutation.isPending ? 'Booking…' : 'Book appointment'}
            </button>
            <Link to="/login" className="btn-ghost text-sm">
              <Info size={14} /> Have an account? Log in
            </Link>
          </div>
        </div>
      </form>

      <div className="card-flat flex items-start gap-3">
        <Languages className="text-accent shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-neutral-700 dark:text-slate-300">
          Need help filling this in another language? Visit any AfyaConnect helpdesk in Kakuma 1, Kakuma 3
          or Kalobeyei Main — staff speak English, Kiswahili, Arabic and French.
        </div>
      </div>
    </div>
  );
}

function SuccessView({ result, patient, liveQueue, setLiveQueue, reset }) {
  useDocumentTitle('Your ticket');
  const a = result.appointment;
  const clinicId = a.clinicId;

  // Subscribe for live updates so the wait-time refreshes if the clinic moves the queue.
  useEffect(() => {
    if (!clinicId) return;
    const socket = getSocket();
    socket.emit('clinic:join', String(clinicId));
    const handler = (payload) => {
      if (String(payload.clinicId) === String(clinicId)) setLiveQueue(payload);
    };
    socket.on('queue:update', handler);
    return () => socket.off('queue:update', handler);
  }, [clinicId, setLiveQueue]);

  const baseQ = result.queue || {};
  const currentlyServing = liveQueue?.currentlyServing ?? baseQ.currentlyServing ?? 0;
  const avg = liveQueue?.avgServiceMinutes ?? baseQ.avgServiceMinutes ?? 8;
  const ahead = Math.max(0, a.ticketNumber - currentlyServing);
  const wait = liveQueue ? ahead * avg : (baseQ.estimatedWaitMinutes ?? 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 print:py-4">
      <div className="card text-center print:!shadow-none print:!border-0">
        <div className="mx-auto inline-grid place-items-center w-16 h-16 rounded-full bg-success/15 text-success mb-3 print:hidden">
          <CheckCircle2 size={36} strokeWidth={2.4} />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-white">
          Appointment booked
        </h1>
        <p className="text-neutral-700 dark:text-slate-300 mt-2">
          Please show this ticket number when you arrive at the clinic.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-start">
          <div className="card-flat">
            <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Ticket #</div>
            <div className="text-3xl font-extrabold text-primary dark:text-accent">{a.ticketNumber}</div>
          </div>
          <div className="card-flat">
            <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Now serving</div>
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">{currentlyServing}</div>
          </div>
          <div className="card-flat">
            <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Estimated wait</div>
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">{wait} min</div>
          </div>
        </div>

        <div className="card-flat mt-4 text-start">
          <div className="font-bold text-primary dark:text-accent">{a.clinicName}</div>
          <div className="text-sm text-neutral-700 dark:text-slate-300">{a.clinicAddress}</div>
        </div>

        {/* Patient + appointment details printed on the ticket */}
        <div className="card-flat mt-4 text-start space-y-3">
          <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">
            Appointment details
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400">Patient name</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {patient?.patientName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400">Phone</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {patient?.patientPhone || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400">Gender</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {patient?.patientSex ? SEX_LABEL[patient.patientSex] : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400">Age</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {patient?.patientAge !== '' && patient?.patientAge != null ? `${patient.patientAge} yrs` : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500 dark:text-slate-400">Hospital</dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {a.clinicName}
                {a.clinicAddress && (
                  <span className="font-normal text-neutral-600 dark:text-slate-400"> — {a.clinicAddress}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1">
                <CalendarDays size={12} /> Date
              </dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {formatDateLong(a.scheduledFor) || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1">
                <Clock size={12} /> Time
              </dt>
              <dd className="font-semibold text-neutral-900 dark:text-white">
                {patient?.scheduledFor
                  ? formatTime(a.scheduledFor)
                  : 'Walk-in (next available)'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 justify-center print:hidden">
          <button type="button" className="btn-outline" onClick={reset}>
            Book another
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={16} /> Print ticket
          </button>
          <Link to="/my-ticket" className="btn-outline">
            <Search size={16} /> Find my ticket later
          </Link>
          <Link to="/clinics" className="btn-primary">
            <MapPin size={16} /> Get directions
          </Link>
        </div>

        <p className="text-xs text-neutral-500 dark:text-slate-400 mt-6 print:hidden">
          Tip: take a screenshot of this page or print it so you remember your ticket number.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Hospital picker. Patient chooses one of the partner clinics first;
// only after that do they see the booking form. Keeps each screen focused.
// ---------------------------------------------------------------------------
function ClinicPicker({ clinics, loading, onPick }) {
  useDocumentTitle('Choose a hospital');
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:py-12 space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 chip-accent mb-2">
          <Building2 size={14} /> Step 1 of 2 — Choose a hospital
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
          Where would you like to book?
        </h1>
        <p className="mt-2 text-neutral-700 dark:text-slate-300">
          Tap a partner hospital below to start your booking. You will fill in the patient details on the next screen.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-40" />
          ))}
        </div>
      ) : !clinics?.length ? (
        <div className="card-flat text-center text-sm text-neutral-600 dark:text-slate-400">
          No partner hospitals are available right now. Please try again later.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((c) => (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="card text-start w-full h-full hover:shadow-lg hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center w-10 h-10 rounded-full bg-primary/10 text-primary dark:bg-accent/20 dark:text-accent shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-neutral-900 dark:text-white truncate">
                      {c.name}
                    </div>
                    {c.address && (
                      <div className="text-sm text-neutral-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {c.hours && (
                  <div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1 mt-3">
                    <Clock size={12} /> {c.hours}
                  </div>
                )}

                {Array.isArray(c.services) && c.services.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.services.slice(0, 4).map((s) => (
                      <span key={s} className="chip-primary !text-[11px] !py-0.5 !px-2">
                        {s}
                      </span>
                    ))}
                    {c.services.length > 4 && (
                      <span className="text-[11px] text-neutral-500 dark:text-slate-400 self-center">
                        +{c.services.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary dark:text-accent">
                  Book here <ChevronRight size={14} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="card-flat flex items-start gap-3">
        <Info className="text-accent shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-neutral-700 dark:text-slate-300">
          Not sure which hospital is closest? Open the{' '}
          <Link to="/clinics" className="underline font-semibold">clinics map</Link> to see all partner hospitals on a map.
        </div>
      </div>
    </div>
  );
}
