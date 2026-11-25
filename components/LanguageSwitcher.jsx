import { useLanguage } from './LanguageProvider';
import styles from '../styles/LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <div className={styles.switcher} role="group" aria-label="Nyelv / Language">
    <button type="button" lang="hu" aria-label="Magyar" aria-pressed={language === 'hu'} onClick={() => setLanguage('hu')}>HU</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
