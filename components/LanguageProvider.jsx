import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { translate } from '../lib/client/translations.mjs';
import { alternatePath, identifyPath } from '../data/site.mjs';

const LanguageContext = createContext({ language: 'hu', locale: 'hu-HU', t: value => value, setLanguage: () => {} });
export function LanguageProvider({ children, initialLanguage, availableLanguages = ['hu', 'en'] }) {
  const router = useRouter();
  const publicPage = identifyPath(router.asPath || '/');
  const isPublic = Boolean(publicPage);
  const [privateLanguage, setPrivateLanguage] = useState(router.query.lang === 'en' ? 'en' : 'hu');
  // Public content is determined on the server by its URL, never by storage.
  const language = initialLanguage || publicPage?.language || privateLanguage;
  useEffect(() => {
    if (initialLanguage || isPublic || !router.isReady) return;
    let saved;
    try { saved = localStorage.getItem('demeters-language'); } catch {}
    setPrivateLanguage(['hu', 'en'].includes(router.query.lang) ? router.query.lang : saved === 'en' ? 'en' : 'hu');
  }, [initialLanguage, isPublic, router.isReady, router.query.lang, router.asPath]);
  useEffect(() => { document.documentElement.lang = language === 'en' ? 'en' : 'hu-HU'; }, [language]);
  function setLanguage(next) {
    if (!['hu', 'en'].includes(next)) return;
    try { localStorage.setItem('demeters-language', next); } catch {}
    const destination = alternatePath(router.asPath, next);
    if (destination) {
      const query = { ...router.query }; delete query.publicPath; delete query.lang;
      void router.push({ pathname: destination, query, hash: window.location.hash }, undefined, { scroll: false });
    } else {
      setPrivateLanguage(next);
      void router.replace({ pathname: router.pathname, query: { ...router.query, lang: next }, hash: window.location.hash }, undefined, { shallow: true, scroll: false });
    }
  }
  return <LanguageContext.Provider value={{ language, availableLanguages, locale: language === 'en' ? 'en-GB' : 'hu-HU', t: (value, params) => translate(value, language, params), setLanguage }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
