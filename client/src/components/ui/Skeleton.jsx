/**
 * Lightweight skeleton placeholders for loading states.
 * Compose with Tailwind utilities for size:
 *   <Skeleton className="h-6 w-32" />
 */
export function Skeleton({ className = '', rounded = 'rounded-md' }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-neutral-200/70 dark:bg-slate-700/60 ${rounded} ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card ${className}`}>
      <Skeleton className="h-5 w-1/2 mb-3" />
      <SkeletonText lines={3} />
    </div>
  );
}
