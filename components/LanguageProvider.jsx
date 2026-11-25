import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { translate } from '../lib/client/translations.mjs';

const LanguageContext = createContext({ language: 'hu', locale: 'hu-HU', t: value => value, setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const router = useRouter();
  const [language, setLanguageState] = useState('hu');

  useEffect(() => {
    if (!router.isReady) return;
    let saved;
    try { saved = localStorage.getItem('demeters-language'); } catch {}
    const next = ['hu', 'en'].includes(router.query.lang) ? router.query.lang : saved === 'en' ? 'en' : 'hu';
    setLanguageState(next);
    try { localStorage.setItem('demeters-language', next); } catch {}
  }, [router.isReady, router.query.lang]);

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  function setLanguage(next) {
    if (!['hu', 'en'].includes(next)) return;
    setLanguageState(next);
    try { localStorage.setItem('demeters-language', next); } catch {}
    void router.replace({ pathname: router.pathname, query: { ...router.query, lang: next }, hash: window.location.hash }, undefined, { shallow: true, scroll: false });
  }

  return <LanguageContext.Provider value={{ language, locale: language === 'en' ? 'en-GB' : 'hu-HU', t: (value, params) => translate(value, language, params), setLanguage }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
