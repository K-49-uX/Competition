import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, BookOpen } from 'lucide-react';
import { api } from '../api/client.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { TopicIcon } from '../components/ui/TopicIcon.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const CATEGORIES = ['hygiene', 'nutrition', 'maternal', 'general'];

export default function Education() {
  useDocumentTitle('Health education');
  const { t, i18n } = useTranslation();
  const [cat, setCat] = useState('');
  const [query, setQuery] = useState('');

  const { data: items, isLoading } = useQuery({
    queryKey: ['education', i18n.language, cat],
    queryFn: () =>
      api
        .get('/education', { params: { lang: i18n.language?.split('-')[0] || 'en', category: cat || undefined } })
        .then((r) => r.data.items),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items || [];
    return (items || []).filter((it) =>
      it.title?.toLowerCase().includes(q) ||
      it.body?.toLowerCase().includes(q) ||
      it.slug?.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-neutral-900 dark:text-white">
          {t('education.title')}
        </h1>
        <p className="text-neutral-700 dark:text-slate-300 max-w-2xl">{t('education.intro')}</p>
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          {t('education.sources')}: WHO · UNHCR · UNICEF · CDC · MSF
        </p>
      </header>

      <div className="card-flat flex flex-col md:flex-row gap-3">
        <label className="flex-1">
          <span className="sr-only">Search topics</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search topics — e.g. cholera, breastfeeding, malaria"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <button
          onClick={() => setCat('')}
          className={`px-4 py-2 rounded-pill text-sm font-semibold whitespace-nowrap transition-colors ${
            cat === ''
              ? 'bg-primary text-white dark:bg-accent'
              : 'bg-white text-primary border border-primary dark:bg-[#111a2e] dark:text-accent dark:border-accent'
          }`}
        >
          {t('education.all')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-pill text-sm font-semibold whitespace-nowrap transition-colors ${
              cat === c
                ? 'bg-primary text-white dark:bg-accent'
                : 'bg-white text-primary border border-primary dark:bg-[#111a2e] dark:text-accent dark:border-accent'
            }`}
          >
            {t(`education.categories.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <Skeleton className="h-12 w-12 mb-3" rounded="rounded-xl" />
              <Skeleton className="h-5 w-2/3 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No matching topics"
          body="Try another keyword or clear the search."
          action={
            <button onClick={() => { setQuery(''); setCat(''); }} className="btn-outline text-sm">
              Clear
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Link
              key={item._id}
              to={`/education/${item.slug}`}
              className="card hover:shadow-md hover:border-primary/40 transition group flex flex-col"
            >
              <TopicIcon slug={item.slug} category={item.category} size="md" className="mb-3" />
              <h2 className="font-bold text-primary dark:text-accent group-hover:underline mb-1">
                {item.title}
              </h2>
              <p className="text-sm text-neutral-700 dark:text-slate-300 flex-1">{item.body}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
                  {t(`education.categories.${item.category}`)}
                </span>
                <span className="text-sm font-semibold text-primary dark:text-accent group-hover:underline">
                  {t('education.readMore')} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
