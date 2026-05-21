import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Accessible confirmation dialog.
 *   <ConfirmDialog open={open} onCancel={...} onConfirm={...} title="..." />
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger', // 'danger' | 'primary'
  busy = false,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass = tone === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div className="w-full max-w-md card-flat !p-0 overflow-hidden">
        <div className="flex items-start gap-3 p-5">
          <div className={`shrink-0 grid place-items-center w-10 h-10 rounded-full ${tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-primary/15 text-primary'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h2 id="confirm-title" className="font-bold text-neutral-900 dark:text-white">
              {title}
            </h2>
            {message && (
              <p className="text-sm text-neutral-700 dark:text-slate-300 mt-1">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 px-5 pb-5 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={confirmClass}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
