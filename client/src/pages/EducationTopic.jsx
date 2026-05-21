import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { TopicIcon } from '../components/ui/TopicIcon.jsx';

const ORG_BADGE = {
  WHO:    'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
  UNHCR:  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  UNICEF: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  CDC:    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  MSF:    'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  IFRC:   'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
};

export default function EducationTopic() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['education-topic', slug, i18n.language],
    queryFn: () =>
      api
        .get(`/education/${slug}`, { params: { lang: i18n.language?.split('-')[0] || 'en' } })
        .then((r) => r.data.item),
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-neutral-600 dark:text-slate-400">{t('common.loading')}</div>;
  }
  if (isError || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <p className="text-neutral-700 dark:text-slate-300">{t('common.error')}</p>
        <Link to="/education" className="text-primary dark:text-accent font-semibold underline">
          ← {t('education.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8 lg:py-12 space-y-8">
      <Link to="/education" className="text-sm text-primary dark:text-accent font-semibold hover:underline">
        ← {t('education.backToList')}
      </Link>

      <header className="space-y-3">
        <TopicIcon slug={data.slug} category={data.category} size="lg" />
        <p className="text-xs font-bold uppercase tracking-wider text-primary dark:text-accent">
          {t(`education.categories.${data.category}`)}
        </p>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-neutral-900 dark:text-white leading-tight">{data.title}</h1>
        <p className="text-lg text-neutral-700 dark:text-slate-300">{data.body}</p>
      </header>

      {data.keyFacts?.length > 0 && (
        <section className="rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-accent mb-3">
            {t('education.keyFacts')}
          </h2>
          <ul className="space-y-2">
            {data.keyFacts.map((f, i) => (
              <li key={i} className="flex gap-3 text-neutral-900 dark:text-slate-100">
                <span className="text-primary dark:text-accent font-bold mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.details?.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('education.learnMore')}</h2>
          {data.details.map((p, i) => (
            <p key={i} className="text-neutral-800 dark:text-slate-200 leading-relaxed">{p}</p>
          ))}
        </section>
      )}

      {data.resources?.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('education.resourcesTitle')}</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">{t('education.resourcesSub')}</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.resources.map((r, i) => (
              <li key={i}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full rounded-xl border border-neutral-200 dark:border-slate-700 hover:border-primary/40 dark:hover:border-accent/50 hover:shadow-md transition p-4 bg-white dark:bg-[#111a2e]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${ORG_BADGE[r.org] || 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}>
                      {r.org}
                    </span>
                    <span className="text-xs text-primary dark:text-accent font-bold">↗</span>
                  </div>
                  <h3 className="font-semibold text-primary dark:text-accent underline decoration-transparent group-hover:decoration-current">
                    {r.title}
                  </h3>
                  {r.description && (
                    <p className="text-sm text-neutral-700 dark:text-slate-300 mt-1">{r.description}</p>
                  )}
                  <p className="text-xs text-primary/70 dark:text-accent/80 mt-2 truncate">{r.url}</p>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500 dark:text-slate-500">{t('education.disclaimer')}</p>
        </section>
      )}
    </article>
  );
}
