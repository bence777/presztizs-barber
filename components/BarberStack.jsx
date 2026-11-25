import { useEffect, useState } from 'react';
import { getTeamBarbers } from '../data/team.mjs';
import { loadPublicCatalog } from '../lib/client/bookingCache.mjs';
import { useLanguage } from './LanguageProvider';
import BarberCarousel from './BarberCarousel';
import styles from '../styles/BarberStack.module.css';

export default function BarberStack() {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    let active = true;
    loadPublicCatalog().then(data => { if (active) setCatalog(data.barbers || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const barbers = getTeamBarbers(catalog, { includeMissing: true });
  return <section id="csapat" className={styles.section} aria-labelledby="team-heading">
    <BarberCarousel barbers={barbers} heading={t("A csapat")} headingId="team-heading" />
  </section>;
}
