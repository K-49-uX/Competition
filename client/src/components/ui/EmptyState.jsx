import { Inbox } from 'lucide-react';

/**
 * Friendly empty state with icon, title, body and optional action.
 *   <EmptyState title="No appointments yet" body="Book your first..." action={<Link .../>} />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  body,
  action,
  className = '',
}) {
  return (
    <div className={`text-center py-10 px-4 ${className}`}>
      <div className="mx-auto inline-grid place-items-center w-14 h-14 rounded-full bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400 mb-3">
        <Icon size={26} strokeWidth={2} />
      </div>
      <div className="font-bold text-neutral-900 dark:text-white">{title}</div>
      {body && (
        <p className="text-sm text-neutral-600 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {body}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
