import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLanguage } from '../components/LanguageProvider';
import Head from 'next/head';
import BookingIdentityGate from '../components/BookingIdentityGate';
import TrustedDevices from '../components/TrustedDevices';
export default function GuestDevices(){
  const { t } = useLanguage();return <><Head><title>{t("Megbízható eszközeim | DEMETERS")}</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
  <main style={{background:'var(--site-background)',minHeight:'100svh',color:'var(--site-ink)'}}>
    <nav style={{maxWidth:1200,margin:'auto',padding:'22px 20px',display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',fontFamily:'Arial,sans-serif'}}>
      <a href="/" style={{color:'var(--site-ink)',fontWeight:700,textDecoration:'none'}}>DEMETERS</a>
      <a href="/foglalasaim" style={{color:'var(--site-copy)',textDecoration:'none'}}>{t("← Foglalásaim")}</a>
      <LanguageSwitcher />
    </nav>
    <BookingIdentityGate><TrustedDevices scope="guest"/></BookingIdentityGate>
  </main></>}
