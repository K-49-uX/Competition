import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HeartPulse,
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  BookOpen,
  User as UserIcon,
  Shield,
  LogOut,
  Menu as MenuIcon,
  X,
  Phone,
  Mail,
  Info,
  Home as HomeIcon,
  BarChart3,
  HeartHandshake,
  ShieldCheck,
} from 'lucide-react';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { SOSButton } from '../components/ui/SOSButton.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

function Logo({ size = 'md' }) {
  const px = size === 'lg' ? 32 : size === 'sm' ? 22 : 26;
  return (
    <span className="flex items-center gap-2">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white shadow-sm">
        <HeartPulse size={px - 6} strokeWidth={2.4} />
      </span>
    </span>
  );
}

function NavLinks({ items, onClick }) {
  return items.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-2 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary dark:bg-accent/15 dark:text-accent'
            : 'text-neutral-900/80 hover:bg-primary-50 hover:text-primary dark:text-slate-200 dark:hover:bg-accent/10 dark:hover:text-accent'
        }`
      }
    >
      {item.icon && <item.icon size={14} />}
      <span>{item.label}</span>
    </NavLink>
  ));
}

export function SiteShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'clinician';

  const publicNav = [
    { to: '/', label: t('site.home'), end: true, icon: HomeIcon },
    { to: '/clinics', label: t('site.findClinic'), icon: MapPin },
    { to: '/book', label: 'Book', icon: CalendarCheck },
    { to: '/education', label: t('nav.education'), icon: BookOpen },
    { to: '/impact', label: t('site.impact') || 'Impact', icon: BarChart3 },
    { to: '/donate', label: t('site.donate') || 'Donate', icon: HeartHandshake },
    { to: '/transparency', label: t('site.transparency') || 'Transparency', icon: ShieldCheck },
    { to: '/about', label: t('site.about'), icon: Info },
  ];

  const authedNav = [
    { to: '/app', label: t('site.home'), end: true, icon: HomeIcon },
    { to: '/dashboard', label: t('nav.home'), icon: LayoutDashboard },
    { to: '/queue', label: t('site.appointments'), icon: CalendarCheck },
    { to: '/clinics', label: t('site.findClinic'), icon: MapPin },
    { to: '/education', label: t('nav.education'), icon: BookOpen },
    { to: '/impact', label: t('site.impact') || 'Impact', icon: BarChart3 },
    { to: '/donate', label: t('site.donate') || 'Donate', icon: HeartHandshake },
    { to: '/transparency', label: t('site.transparency') || 'Transparency', icon: ShieldCheck },
    { to: '/about', label: t('site.about'), icon: Info },
  ];

  const items = user ? authedNav : publicNav;

  // Bottom nav: same 4 items so users always have one-tap access on mobile/tablet
  const bottomNav = [
    { to: user ? '/app' : '/', label: t('site.home'), end: true, icon: HomeIcon },
    { to: user ? '/queue' : '/book', label: user ? t('site.appointments') : 'Book', icon: CalendarCheck },
    { to: '/clinics', label: t('site.findClinic'), icon: MapPin },
    { to: '/education', label: t('nav.education'), icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Skip-to-content for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] focus:bg-primary focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>
      {/* Top utility strip */}
      <div className="bg-primary text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
          <Link to={user ? '/app' : '/'} className="flex items-center gap-2 hover:opacity-90">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/15 ring-1 ring-white/30">
              <HeartPulse size={16} strokeWidth={2.4} />
            </span>
            <span className="font-extrabold tracking-tight text-sm">{t('app.name')}</span>
          </Link>
          <span className="opacity-90 hidden sm:flex items-center gap-1.5">
            <Phone size={12} />
            <span>
              Emergency:{' '}
              <a
                href="tel:+254706583970"
                className="underline hover:no-underline font-semibold"
              >
                +254 706 583 970
              </a>{' '}
              · {t('site.utility')}
            </span>
          </span>
          <LangToggle compact />
        </div>
      </div>

      {/* Main navbar */}
      <header className="bg-white border-b border-neutral-50 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={user ? '/app' : '/'} className="md:hidden flex items-center gap-2 shrink-0" aria-label={t('app.name')}>
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            <NavLinks items={items} />
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SOSButton variant="navbar" />

            {user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-50 text-sm font-semibold text-neutral-900 dark:text-slate-100 dark:hover:bg-accent/15"
                >
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold overflow-hidden">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || 'Profile'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name?.[0]?.toUpperCase() || 'U'
                    )}
                  </span>
                  <span className="hidden lg:inline">{user.name?.split(' ')[0]}</span>
                </button>
                {profileOpen && (
                  <div
                    className="absolute end-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-card shadow-card border border-neutral-50 dark:border-slate-700 py-2 z-40"
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-900 dark:text-slate-100 hover:bg-primary-50 dark:hover:bg-accent/15">
                      <UserIcon size={16} /> {t('nav.profile')}
                    </Link>
                    {isStaff && (
                      <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-900 dark:text-slate-100 hover:bg-primary-50 dark:hover:bg-accent/15">
                        <Shield size={16} /> {t('nav.admin')}
                      </Link>
                    )}
                    <button
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="flex items-center gap-2 w-full text-start px-4 py-2 text-sm hover:bg-danger/10 text-danger"
                    >
                      <LogOut size={16} /> {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex gap-2">
                <Link to="/login" className="btn-outline !py-2 !px-4 text-sm">{t('auth.login')}</Link>
                <Link to="/register" className="btn-primary !py-2 !px-4 text-sm">{t('site.getStarted')}</Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-primary-50"
              aria-label="Menu"
            >
              {menuOpen ? <X size={22} /> : <MenuIcon size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-neutral-50">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              <NavLinks items={items} onClick={() => setMenuOpen(false)} />
              {user ? (
                <>
                  <Link onClick={() => setMenuOpen(false)} to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary-50">
                    <UserIcon size={16} /> {t('nav.profile')}
                  </Link>
                  {isStaff && (
                    <Link onClick={() => setMenuOpen(false)} to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary-50">
                      <Shield size={16} /> {t('nav.admin')}
                    </Link>
                  )}
                  <button onClick={() => { setMenuOpen(false); logout(); }} className="flex items-center gap-2 text-start px-3 py-2 rounded-lg text-sm font-semibold text-danger hover:bg-danger/10">
                    <LogOut size={16} /> {t('nav.logout')}
                  </button>
                </>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Link onClick={() => setMenuOpen(false)} to="/login" className="btn-outline flex-1 !py-2 text-sm">{t('auth.login')}</Link>
                  <Link onClick={() => setMenuOpen(false)} to="/register" className="btn-primary flex-1 !py-2 text-sm">{t('site.getStarted')}</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Extra bottom padding on small screens to clear the bottom nav */}
      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* Footer (hidden on small screens to avoid clashing with bottom nav) */}
      <footer className="bg-neutral-900 text-white mt-12 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Logo />
              <span className="font-bold text-lg">{t('app.name')}</span>
            </div>
            <p className="text-sm text-white/70">{t('app.tagline')}</p>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">{t('site.platform')}</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li><Link to="/clinics" className="hover:text-white">{t('site.findClinic')}</Link></li>
              <li><Link to="/education" className="hover:text-white">{t('nav.education')}</Link></li>
              <li><Link to="/book" className="hover:text-white">Book appointment</Link></li>
              <li><Link to="/my-ticket" className="hover:text-white">Find my ticket</Link></li>
              <li><Link to="/queue" className="hover:text-white">{t('site.appointments')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">{t('site.account')}</h4>
            <ul className="space-y-2 text-sm text-white/80">
              {!user && <li><Link to="/login" className="hover:text-white">{t('auth.login')}</Link></li>}
              {!user && <li><Link to="/register" className="hover:text-white">{t('auth.register')}</Link></li>}
              {user && <li><Link to="/profile" className="hover:text-white">{t('nav.profile')}</Link></li>}
              <li><Link to="/about" className="hover:text-white">{t('site.about')}</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">{t('site.contact')}</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2"><MapPin size={14} /> Kakuma Refugee Camp, Kenya</li>
              <li className="flex items-center gap-2"><Phone size={14} /> +254 700 000 000</li>
              <li className="flex items-center gap-2"><Mail size={14} /> help@afyaconnect.org</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-white/60 flex justify-between">
            <span>© {new Date().getFullYear()} AfyaConnect</span>
            <span>{t('site.builtFor')}</span>
          </div>
        </div>
      </footer>

      {/* Bottom navigation — mobile + tablet only */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-100 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:bg-[#111a2e] dark:border-slate-800"
      >
        <ul className="grid grid-cols-4">
          {bottomNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'text-primary dark:text-accent'
                      : 'text-neutral-900/60 hover:text-primary dark:text-slate-300 dark:hover:text-accent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                    <span className="truncate max-w-[72px]">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
