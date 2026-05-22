import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

export function AdminShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const tabs = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin', label: t('admin.tabs.queues'), end: true },
    { to: '/admin/appointments', label: 'Appointments' },
    { to: '/admin/staff', label: 'Staff' },
    { to: '/admin/audit', label: 'Audit' },
    { to: '/admin/onboarding', label: 'Onboarding' },
    { to: '/admin/sos', label: t('admin.tabs.sos') },
    { to: '/admin/campaigns', label: t('admin.tabs.campaigns') },
    { to: '/admin/testimonials', label: 'Testimonials' },
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside className="bg-primary text-white p-6 lg:min-h-screen">
        <div className="flex items-center gap-2 mb-8">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15">
            <HeartPulse size={22} strokeWidth={2.4} />
          </span>
          <div>
            <div className="font-bold text-lg">{t('app.name')}</div>
            <div className="text-xs opacity-80">{t('admin.title')}</div>
          </div>
        </div>
        <nav className="flex lg:flex-col gap-2 mb-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg font-semibold transition-colors ${
                  isActive ? 'bg-white text-primary' : 'hover:bg-primary-700'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/20 text-sm">
          <div className="opacity-80 mb-2">{user?.name}</div>
          <button onClick={logout} className="underline opacity-90 hover:opacity-100">
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex flex-col bg-neutral-50 dark:bg-[#0b1220]">
        <header className="bg-white dark:bg-[#111a2e] dark:border-b dark:border-slate-800 px-6 py-3 flex justify-between items-center shadow-sm">
          <NavLink to="/" className="text-sm text-primary dark:text-accent underline">
            ← {t('nav.home')}
          </NavLink>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangToggle compact />
          </div>
        </header>
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
