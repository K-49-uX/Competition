import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import sw from './locales/sw.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

export const SUPPORTED = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'sw', label: 'Kiswahili', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

function applyDir(lng) {
  const meta = SUPPORTED.find((l) => l.code === lng) || SUPPORTED[0];
  document.documentElement.setAttribute('dir', meta.dir);
  document.documentElement.setAttribute('lang', meta.code);
}

applyDir(i18n.language?.split('-')[0] || 'en');
i18n.on('languageChanged', (lng) => applyDir(lng.split('-')[0]));

export default i18n;
