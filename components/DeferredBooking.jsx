import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from './LanguageProvider';
const BookingWizard = dynamic(() => import('./BookingWizard'), { ssr: false });
export default function DeferredBooking({ bookingRequest }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    const loadFromLink = () => { if (window.location.hash === '#foglalas' || new URLSearchParams(window.location.search).has('barber') || new URLSearchParams(window.location.search).has('service')) setReady(true); };
    loadFromLink();
    window.addEventListener('hashchange', loadFromLink);
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); } }, { rootMargin: '500px' });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); window.removeEventListener('hashchange', loadFromLink); };
  }, []);
  useEffect(() => { if (bookingRequest) setReady(true); }, [bookingRequest]);
  return <div ref={ref} style={{ minHeight: 620 }}>{ready ? <BookingWizard bookingRequest={bookingRequest} /> : <button type="button" onClick={() => setReady(true)} style={{ minHeight: 48, padding: '12px 22px', border: '1px solid currentColor', background: 'transparent', font: 'inherit', cursor: 'pointer' }}>{t('Időpontfoglalás')}</button>}</div>;
}
