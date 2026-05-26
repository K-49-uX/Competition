import { useTranslation } from 'react-i18next';
import { SUPPORTED } from '../../i18n.js';

export function LangToggle({ compact = false }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.split('-')[0] || 'en';

  return (
    <div className="flex gap-1 bg-white/80 dark:bg-slate-800/80 dark:ring-1 dark:ring-slate-700 rounded-pill px-1 py-1 shadow-card backdrop-blur">
      {SUPPORTED.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => i18n.changeLanguage(lang.code)}
          className={[
            'px-3 py-1.5 text-xs font-semibold rounded-pill transition-colors',
            current === lang.code
              ? 'bg-primary text-white dark:bg-accent dark:text-slate-900'
              : 'text-neutral-900/70 hover:bg-primary-50 dark:text-slate-100 dark:hover:bg-accent/20',
          ].join(' ')}
          aria-pressed={current === lang.code}
          aria-label={lang.label}
        >
          {compact ? lang.code.toUpperCase() : lang.label}
        </button>
      ))}
    </div>
  );
}
