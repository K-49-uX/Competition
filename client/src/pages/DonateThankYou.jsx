import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, HeartHandshake, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function DonateThankYou() {
  useDocumentTitle('Thank you');
  const [params] = useSearchParams();
  const session = params.get('session');
  const provider = params.get('provider') || 'stub';
  const [state, setState] = useState({ status: 'confirming', donation: null, error: null });

  // Stub provider: explicit confirm call (real providers do this server-side
  // via webhook, so we just poll once for the latest status).
  useEffect(() => {
    if (!session) { setState({ status: 'noop', donation: null, error: null }); return; }
    let cancelled = false;
    const action = provider === 'stub'
      ? api.post('/donations/confirm', { providerSessionId: session })
      : Promise.resolve({ data: {} });
    action
      .then(({ data }) => { if (!cancelled) setState({ status: 'ok', donation: data.donation, error: null }); })
      .catch((err) => { if (!cancelled) setState({ status: 'error', donation: null, error: err?.response?.data?.error || 'unknown' }); });
    return () => { cancelled = true; };
  }, [session, provider]);

  return (
    <main id="main-content" className="bg-neutral-50">
      <section className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        {state.status === 'confirming' && (
          <>
            <Loader2 size={36} className="mx-auto animate-spin text-primary" />
            <h1 className="text-2xl font-extrabold">Confirming your donation…</h1>
          </>
        )}
        {(state.status === 'ok' || state.status === 'noop') && (
          <>
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="text-3xl font-extrabold">Thank you!</h1>
            {state.donation ? (
              <p className="text-neutral-700 dark:text-slate-300">
                Your gift of <span className="font-bold">
                  {formatAmount(state.donation.amount, state.donation.currency)}
                </span> is in. A receipt is on its way to your inbox.
              </p>
            ) : (
              <p className="text-neutral-700 dark:text-slate-300">
                Your generosity keeps clinics open and patients seen.
              </p>
            )}
            <div className="card-flat !p-5 inline-flex items-center gap-2 text-sm">
              <HeartHandshake size={18} className="text-success" />
              Share this page with someone who cares about refugee healthcare.
            </div>
            <div className="flex justify-center gap-3 pt-4">
              <Link to="/impact" className="btn-outline">See your impact</Link>
              <Link to="/" className="btn-primary">Back to home</Link>
            </div>
          </>
        )}
        {state.status === 'error' && (
          <>
            <AlertTriangle size={48} className="mx-auto text-danger" />
            <h1 className="text-2xl font-extrabold text-danger">Could not confirm donation</h1>
            <p className="text-sm text-neutral-700 dark:text-slate-300">
              {state.error === 'session_not_found'
                ? 'We could not find that checkout session. If you were charged, please email partners@afyaconnect.org with your receipt.'
                : 'Something went wrong on our side. Please try again or contact partners@afyaconnect.org.'}
            </p>
            <Link to="/donate" className="btn-outline">Try again</Link>
          </>
        )}
      </section>
    </main>
  );
}

function formatAmount(amount, currency) {
  if (!amount || !currency) return '';
  const major = currency === 'KES' ? amount / 100 : amount / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
