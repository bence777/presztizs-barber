import {useEffect,useState} from 'react';
import GuestIdentity from './GuestIdentity';
import styles from '../styles/BookingManage.module.css';
export default function BookingIdentityGate({children}) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    async function check(){
      try {
        const response=await fetch('/api/guest/me',{cache:'no-store',credentials:'same-origin'});
        if(!active)return;
        if(response.status===401){setReady(false);return;}
        if(response.ok){const data=await response.json();if(active)setReady(!!data?.profile);}
      }catch{/* Transient network failures must not create a new session. */}
    }
    void check();
    const onFocus=()=>{void check()};
    const onVisible=()=>{if(document.visibilityState==='visible')void check()};
    const interval=setInterval(check,60000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[]);
  if(ready)return children;
  return <section className={styles.gate}><p className={styles.kicker}>BIZTONSÁGOS BELÉPÉS</p><h2>Azonosítsd <em>magad.</em></h2><p>A saját e-mail-címedre küldött ellenőrző kóddal férhetsz hozzá a foglalásokhoz. Ha ezen az eszközön már beléptél, jóváhagyhatod a mentett profilodat.</p><GuestIdentity initialProfile={null} onVerified={profile=>setReady(!!profile)}/></section>;
}
