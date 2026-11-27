import { useRouter } from 'next/router';
import { alternatePath } from '../data/site.mjs';
import { useLanguage } from './LanguageProvider';
import styles from '../styles/LanguageSwitcher.module.css';
export default function LanguageSwitcher() {
  const router = useRouter();
  const { language, availableLanguages = ['hu', 'en'], setLanguage } = useLanguage();
  return <div className={styles.switcher} role="group" aria-label="Nyelv / Language">
    {['hu', 'en'].map((lang, index) => {
      const destination = alternatePath(router.asPath, lang);
      const label = lang === 'hu' ? 'Magyar' : 'English';
      return <span className={styles.choice} key={lang}>{index > 0 && <span aria-hidden="true">/</span>}{!availableLanguages.includes(lang) ? <span aria-disabled="true" title={lang === 'en' ? 'English introduction not yet available' : 'Magyar bemutatkozás még nem érhető el'}>{lang.toUpperCase()}</span> : destination ? <a href={destination} lang={lang} aria-label={label} aria-current={language === lang ? 'page' : undefined} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setLanguage(lang); } }}>{lang.toUpperCase()}</a> : <button type="button" lang={lang} aria-label={label} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>}</span>;
    })}
  </div>;
}
