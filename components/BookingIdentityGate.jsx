import {useEffect,useState} from 'react';
import GuestIdentity from './GuestIdentity';
import styles from '../styles/BookingManage.module.css';
export default function BookingIdentityGate({children}) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{let active=true;fetch('/api/guest/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setReady(!!data?.profile)}).catch(()=>{});return()=>{active=false}},[]);
  if(ready)return children;
  return <section className={styles.gate}><p className={styles.kicker}>BIZTONSÁGOS BELÉPÉS</p><h2>Azonosítsd <em>magad.</em></h2><p>A saját e-mail-címedre küldött ellenőrző kóddal férhetsz hozzá a foglalásokhoz. Ha ezen az eszközön már beléptél, jóváhagyhatod a mentett profilodat.</p><GuestIdentity initialProfile={null} onVerified={profile=>setReady(!!profile)}/></section>;
}
