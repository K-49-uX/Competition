import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, Hash, MapPin, Printer } from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const STATUS_TONE = {
  waiting:   { label: 'Waiting',   chip: 'chip-primary' },
  serving:   { label: 'Now serving', chip: 'chip-success' },
  completed: { label: 'Completed', chip: 'chip-accent' },
  cancelled: { label: 'Cancelled', chip: 'chip-danger' },
};

export default function MyTicket() {
  useDocumentTitle('My ticket');
  const [phone, setPhone] = useState('');
  const [ticket, setTicket] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);

  // Prefill from the last booking saved on this device.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('afya.lastTicket');
      if (!raw) return;
      const data = JSON.parse(raw);
      // Forget tickets older than 24h so stale data doesn't mislead.
      if (data?.savedAt && Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('afya.lastTicket');
        return;
      }
      if (data?.phone) setPhone(data.phone);
      if (data?.ticket) setTicket(String(data.ticket));
      setSaved(data);
    } catch { /* ignore */ }
  }, []);

  async function runLookup(p, t) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.get('/appointments/guest/lookup', {
        params: { phone: p.trim(), ticket: String(t).trim() },
      });
      setResult(data);
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(
        code === 'not_found'
          ? "We couldn't find a ticket matching that phone and number."
          : 'Lookup failed. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  function lookup(ev) {
    ev.preventDefault();
    runLookup(phone, ticket);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:py-12 space-y-5">
      <header>
        <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
          Find my ticket
        </h1>
        <p className="text-neutral-700 dark:text-slate-300 mt-2">
          Booked without an account? Enter the phone number and ticket number you were given to see your live status.
        </p>
      </header>

      {saved && !result && (
        <div className="card-flat flex flex-wrap items-center gap-3 justify-between border-l-4 border-primary">
          <div className="text-sm text-neutral-700 dark:text-slate-300">
            <div className="font-semibold text-neutral-900 dark:text-white">
              Last ticket on this device: #{saved.ticket}
            </div>
            {saved.clinicName && (
              <div className="text-xs text-neutral-500 dark:text-slate-400">{saved.clinicName}</div>
            )}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => runLookup(saved.phone, saved.ticket)}
          >
            <Search size={16} /> Show it now
          </button>
        </div>
      )}

      <form onSubmit={lookup} className="card space-y-3" noValidate>
        <label className="block">
          <span className="label">Phone used at booking</span>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input pl-9"
              type="tel"
              autoComplete="tel"
              placeholder="+254 7XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="block">
          <span className="label">Ticket number</span>
          <div className="relative">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input pl-9"
              type="number"
              min="1"
              placeholder="e.g. 17"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              required
            />
          </div>
        </label>
        {error && (
          <div className="text-sm text-danger" role="alert">{error}</div>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          <Search size={16} /> {busy ? 'Searching…' : 'Find my ticket'}
        </button>
      </form>

      {result?.appointment && (
        <div className="card text-center print:!shadow-none print:!border-0">
          <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">
            Ticket #
          </div>
          <div className="text-6xl font-extrabold text-primary dark:text-accent leading-none my-2">
            {result.appointment.ticketNumber}
          </div>
          <span className={STATUS_TONE[result.appointment.status]?.chip || 'chip-primary'}>
            {STATUS_TONE[result.appointment.status]?.label || result.appointment.status}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-start">
            <div className="card-flat">
              <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Now serving</div>
              <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                #{result.queue?.currentlyServing ?? 0}
              </div>
            </div>
            <div className="card-flat">
              <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Ahead of you</div>
              <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                {Math.max(0, (result.appointment.ticketNumber - (result.queue?.currentlyServing ?? 0)) - 1)}
              </div>
            </div>
            <div className="card-flat">
              <div className="text-xs uppercase font-bold text-neutral-500 dark:text-slate-400">Estimated wait</div>
              <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                {result.queue?.estimatedWaitMinutes ?? 0} min
              </div>
            </div>
          </div>

          <div className="card-flat mt-4 text-start">
            <div className="font-bold text-primary dark:text-accent">{result.appointment.clinicName}</div>
            <div className="text-sm text-neutral-700 dark:text-slate-300">
              {result.appointment.clinicAddress}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 justify-center print:hidden">
            <button onClick={() => window.print()} className="btn-outline">
              <Printer size={16} /> Print ticket
            </button>
            <Link to="/clinics" className="btn-primary">
              <MapPin size={16} /> Get directions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
